## player.gd
## Scene: scenes/games/logic_invaders/Player.tscn
## Root node type: CharacterBody2D
##
## Responsibility: A player-controlled ship.
##   - Authority = the peer whose ID matches the node's name (set by LogicInvaders spawner).
##   - Client-side prediction: the authority peer moves locally every frame.
##   - Other peers receive position via MultiplayerSynchronizer (ON_CHANGE).
##   - Ammo value is selected locally (Q/E or mouse wheel) — no networking until fired.
##   - Firing sends an RPC to the server, which validates sender and logs the shot
##     (physical projectile implemented in Sprint 3).
##
## Authority model:
##   - `name` is set to `str(peer_id)` by the LogicInvaders spawner before add_child().
##   - `set_multiplayer_authority(name.to_int())` maps this node's authority to that peer.
##   - Only the authority peer runs movement input — others render the synced position.
##
## Node tree (build in Editor):
##   Player (CharacterBody2D)       ← this script
##   ├── Sprite2D                   ← player ship sprite
##   ├── CollisionShape2D           ← CapsuleShape2D or RectangleShape2D
##   └── MultiplayerSynchronizer    ← syncs global_position ON_CHANGE

class_name Player
extends CharacterBody2D

# ---------------------------------------------------------------------------
# Node references
# ---------------------------------------------------------------------------

@onready var sprite: Sprite2D = $Sprite2D
@onready var synchronizer: MultiplayerSynchronizer = $MultiplayerSynchronizer

# ---------------------------------------------------------------------------
# Exported configuration
# ---------------------------------------------------------------------------

## Horizontal movement speed in pixels/second.
@export var move_speed: float = 300.0

## The range of valid math answers the player can select.
@export var ammo_min_value: int = 1
@export var ammo_max_value: int = 20

# ---------------------------------------------------------------------------
# Private state
# ---------------------------------------------------------------------------

## The integer value currently "loaded" as ammo.
## Changed by Q/E or mouse wheel. Sent to server when the player fires.
## This is LOCAL state — not synced, because only the authority needs it.
var _current_ammo_value: int = 1

## Screen half-width for clamping the ship within the viewport.
## Updated in _ready() after the scene tree is valid.
var _screen_half_width: float = 240.0

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

func _ready() -> void:
	# === AUTHORITY MAPPING ===
	# The spawner names this node str(peer_id) before add_child().
	# Calling to_int() on that name maps multiplayer authority to the correct peer.
	# This means:
	#   - Peer 2's ship is named "2" → authority = 2 → only peer 2 runs input.
	#   - Peer 3's ship is named "3" → authority = 3 → only peer 3 runs input.
	#   - Peer 1 (server/host) is named "1" → authority = 1.
	var peer_id: int = name.to_int()
	if peer_id <= 0:
		push_error("Player: node name '%s' is not a valid peer ID integer." % name)
		return
	set_multiplayer_authority(peer_id)

	# Cache viewport width for horizontal clamping.
	var viewport_rect: Rect2 = get_viewport_rect()
	_screen_half_width = viewport_rect.size.x * 0.5

	print("Player '%s' ready — authority: %d, is_mine: %s" \
		% [name, peer_id, str(is_multiplayer_authority())])


func _physics_process(delta: float) -> void:
	# === CLIENT-SIDE PREDICTION ===
	# Only the authority peer (the player who owns this ship) processes movement.
	# All other peers receive position from MultiplayerSynchronizer.
	if not is_multiplayer_authority():
		return

	_process_movement(delta)


func _unhandled_input(event: InputEvent) -> void:
	# Only the authority peer processes input for this ship.
	if not is_multiplayer_authority():
		return

	_process_ammo_selection(event)

	# Spacebar or left mouse = fire
	if event.is_action_pressed("ui_accept") or \
	   (event is InputEventMouseButton and \
	    (event as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT and \
	    (event as InputEventMouseButton).pressed):
		_request_fire()

# ---------------------------------------------------------------------------
# Private movement
# ---------------------------------------------------------------------------

func _process_movement(delta: float) -> void:
	var direction: float = Input.get_axis("ui_left", "ui_right")
	velocity.x = direction * move_speed
	velocity.y = 0.0
	move_and_slide()

	# Clamp ship to the visible play area.
	var half_w: float = _screen_half_width
	global_position.x = clampf(global_position.x, 0.0, half_w * 2.0)

# ---------------------------------------------------------------------------
# Ammo value selection (local to authority — no networking)
# ---------------------------------------------------------------------------

func _process_ammo_selection(event: InputEvent) -> void:
	var delta_value: int = 0

	# Q key or mouse-wheel-up → increase ammo value
	if event.is_action_pressed("ui_page_up") or \
	   (event is InputEventMouseButton and \
	    (event as InputEventMouseButton).button_index == MOUSE_BUTTON_WHEEL_UP and \
	    (event as InputEventMouseButton).pressed):
		delta_value = 1

	# E key or mouse-wheel-down → decrease ammo value
	elif event.is_action_pressed("ui_page_down") or \
	     (event is InputEventMouseButton and \
	      (event as InputEventMouseButton).button_index == MOUSE_BUTTON_WHEEL_DOWN and \
	      (event as InputEventMouseButton).pressed):
		delta_value = -1

	if delta_value != 0:
		_current_ammo_value = clampi(
			_current_ammo_value + delta_value,
			ammo_min_value,
			ammo_max_value
		)
		print("Player '%s': ammo value → %d" % [name, _current_ammo_value])
		# Sprint 3: emit a signal here for the HUD label to update.

# ---------------------------------------------------------------------------
# Firing — client sends RPC to server
# ---------------------------------------------------------------------------

## Called on the AUTHORITY CLIENT when the player presses fire.
## Sends the current ammo value to the server for validation and processing.
func _request_fire() -> void:
	# Tag-along guard: if somehow called on a non-authority peer, abort.
	if not is_multiplayer_authority():
		return

	# Send the RPC to the server (peer ID 1).
	# rpc_id(1, ...) targets only the server, saving bandwidth.
	rpc_id(1, "server_receive_fire", _current_ammo_value)


## Receives a fire request from a client. Runs ONLY on the server (peer 1).
##
## RPC mode:
##   "any_peer"  → any connected peer can invoke this RPC (clients sending to server).
##   "reliable"  → guaranteed delivery — a missed fire is worse than a small latency spike.
##
## Security validation:
##   1. Check multiplayer.is_server() — clients should never process this.
##   2. Validate sender_id matches this node's multiplayer authority — prevents
##      cheating where peer 2 fires from peer 3's ship.
@rpc("any_peer", "reliable")
func server_receive_fire(ammo_value: int) -> void:
	# === SERVER-ONLY GUARD ===
	if not multiplayer.is_server():
		return

	var sender_id: int = multiplayer.get_remote_sender_id()

	# === SENDER VALIDATION ===
	# Only the peer who owns this ship may fire it.
	# multiplayer.get_remote_sender_id() returns 0 when called locally (server hosting).
	# The host player fires locally, so sender_id == 0 maps to peer 1.
	var expected_authority: int = get_multiplayer_authority()
	var actual_sender: int = sender_id if sender_id != 0 else 1

	if actual_sender != expected_authority:
		push_warning("Player '%s': unauthorized fire from peer %d (expected %d). Rejected." \
			% [name, actual_sender, expected_authority])
		return

	# === TODO Sprint 3: Spawn a physical Projectile node via MultiplayerSpawner ===
	# For now, log the validated shot to prove the network input pipeline works.
	print("✅ SERVER: Player '%s' (peer %d) fired value: %d" \
		% [name, actual_sender, ammo_value])

	# Sprint 3 hook — the Projectile spawner will call:
	# var proj := PROJECTILE_SCENE.instantiate() as Projectile
	# proj.value = ammo_value
	# proj.global_position = global_position
	# $"../ProjectilesContainer".add_child(proj)  # MultiplayerSpawner handles replication


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Returns the ammo value currently selected on the authority client.
## Only meaningful to call on the authority peer.
func get_current_ammo_value() -> int:
	return _current_ammo_value
