## invader.gd
## Scene: scenes/games/logic_invaders/Invader.tscn
## Root node type: Area2D
##
## Responsibility: A single math-invader entity.
##   - Moves downward on the SERVER only (server-authoritative descent).
##   - Listens to MathShieldComponent for correct/wrong hit results.
##   - On WRONG hit  → server multiplies its speed, broadcasts a shader flash to ALL peers.
##   - On CORRECT hit → server calls queue_free() (MultiplayerSpawner auto-removes on clients).
##
## Authority model:
##   - Server (peer 1) owns position, speed, and game-state mutations.
##   - Clients receive position via MultiplayerSynchronizer (ON_CHANGE).
##   - Visual flash RPC is called from the server and executes locally on all peers.
##
## Node tree (build in Editor):
##   Invader (Area2D)              ← this script, Group: "invader"
##   ├── Sprite2D                  ← ShaderMaterial → elastic_absorb.gdshader
##   ├── CollisionShape2D          ← CapsuleShape2D or RectangleShape2D
##   ├── MathShieldComponent       ← res://components/math_shield_component.gd
##   └── MultiplayerSynchronizer   ← syncs global_position ON_CHANGE

class_name Invader
extends Area2D

# ---------------------------------------------------------------------------
# Node references
# ---------------------------------------------------------------------------

@onready var sprite: Sprite2D = $Sprite2D
@onready var math_shield: MathShieldComponent = $MathShieldComponent
@onready var synchronizer: MultiplayerSynchronizer = $MultiplayerSynchronizer

# ---------------------------------------------------------------------------
# Exported configuration
# ---------------------------------------------------------------------------

## Base downward speed in pixels/second.
@export var base_speed: float = 60.0

## Math question displayed above the invader (set by spawner before add_child).
@export var question_text: String = "?"

# ---------------------------------------------------------------------------
# Private state
# ---------------------------------------------------------------------------

## Current descent speed on the server — modified by Elastic Feedback penalty.
## Replicated to clients via MultiplayerSynchronizer.
var _current_speed: float = 0.0

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

func _ready() -> void:
	_current_speed = base_speed

	# Wire educational core signals.
	# IMPORTANT: connect() in _ready(), not in the editor, so the binding is
	# type-verified at parse time. Both signals only fire on the server.
	math_shield.shield_broken.connect(_on_shield_broken)
	math_shield.wrong_answer_absorbed.connect(_on_wrong_answer_absorbed)

	# Set authority: invaders are owned by the server (peer 1, the default).
	# Explicit call surfaces intent — do not silently rely on the default.
	set_multiplayer_authority(1)


func _physics_process(delta: float) -> void:
	# SERVER-ONLY motion. Clients receive position from MultiplayerSynchronizer.
	if not multiplayer.is_server():
		return

	global_position.y += _current_speed * delta

	# Despawn when the invader exits the play field (reached the bottom).
	# In Sprint 3, replace this with: GameManager.on_invader_breakthrough().
	if global_position.y > 1000.0:
		queue_free()

# ---------------------------------------------------------------------------
# MathShieldComponent signal handlers (fired on SERVER only)
# ---------------------------------------------------------------------------

## Called by MathShieldComponent when a projectile carries the WRONG value.
## Applies the Elastic Feedback speed penalty and triggers the visual flash on all peers.
func _on_wrong_answer_absorbed(penalty_multiplier: float) -> void:
	# Guard is technically redundant (MathShieldComponent already guards),
	# but we keep it here as explicit documentation of the authority contract.
	if not multiplayer.is_server():
		return

	_current_speed *= penalty_multiplier
	print("Invader %s: speed × %.2f = %.1f px/s" % [name, penalty_multiplier, _current_speed])

	# Broadcast the visual flash to ALL peers (including the server itself).
	trigger_absorb_flash.rpc()


## Called by MathShieldComponent when a projectile carries the CORRECT value.
## Server despawns the invader; MultiplayerSpawner propagates removal to clients.
func _on_shield_broken() -> void:
	if not multiplayer.is_server():
		return

	print("Invader %s: shield broken — despawning." % name)
	# queue_free() on a MultiplayerSpawner-managed node automatically removes
	# the node on all peers. Do NOT call rpc_id() for this.
	queue_free()

# ---------------------------------------------------------------------------
# RPC: Visual feedback — runs on ALL peers including the caller (server)
# ---------------------------------------------------------------------------

## Triggers the elastic absorb shader flash on every peer's Sprite2D.
## Called exclusively from the server (_on_wrong_answer_absorbed).
##
## RPC mode breakdown:
##   "authority"   → only the multiplayer authority (server, peer 1) may call this RPC.
##   "call_local"  → the server also executes the function locally (not just clients).
##   "reliable"    → guaranteed delivery — flash must always be seen.
@rpc("authority", "call_local", "reliable")
func trigger_absorb_flash() -> void:
	# Retrieve the ShaderMaterial from the Sprite2D.
	var mat: ShaderMaterial = sprite.material as ShaderMaterial
	if mat == null:
		push_error("Invader %s: Sprite2D has no ShaderMaterial — attach elastic_absorb.gdshader." % name)
		return

	# Animate hit_flash_intensity 1.0 → 0.0 over 0.3 seconds using a Tween.
	# Tween is local to this peer — no networking needed for pure visuals.
	var tween: Tween = create_tween()
	tween.tween_method(
		func(value: float) -> void:
			mat.set_shader_parameter("hit_flash_intensity", value),
		1.0,   # from
		0.0,   # to
		0.3    # duration in seconds
	)

# ---------------------------------------------------------------------------
# Public API (called by projectile collision, server-side)
# ---------------------------------------------------------------------------

## Entry point for a projectile hit. Must only be called on the SERVER.
## [param projectile_value] is the integer displayed on the fired projectile.
func receive_hit(projectile_value: int) -> void:
	if not multiplayer.is_server():
		push_error("Invader.receive_hit() called on a non-server peer. Use an RPC.")
		return
	math_shield.evaluate_hit(projectile_value)
