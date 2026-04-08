## MathShieldComponent.gd
## Reusable Composition Node: Encapsulates the math-shield gameplay logic for an invader.
##
## Responsibility: Validates incoming projectile values against a target answer.
##   - Correct hit  → emits [signal shield_broken] (removes shield, invader vulnerable).
##   - Wrong hit    → emits [signal wrong_answer_absorbed] with a penalty multiplier
##                    that the invader uses to increase descent speed ("Elastic Feedback").
##
## Composition: Attach this as a child node of any invader scene.
##   The parent invader does NOT inherit from this — it LISTENS to its signals.
##
## Authority: ALL state mutations are server-only.
##   `if not multiplayer.is_server(): return` guards evaluate_hit().
##   Clients receive visual feedback via @rpc calls from the server (see parent scene).
##
## Usage:
##   @onready var math_shield: MathShieldComponent = $MathShieldComponent
##   math_shield.target_value = randi_range(1, 20)
##   math_shield.shield_broken.connect(_on_shield_broken)
##   math_shield.wrong_answer_absorbed.connect(_on_wrong_answer)
##
## Scene isolation: This node can be run standalone (F6 test passes).
##   It has no dependency on its parent type or sibling nodes.

class_name MathShieldComponent
extends Node

# ---------------------------------------------------------------------------
# Signals
# ---------------------------------------------------------------------------

## Emitted (server-only) when [param projectile_value] equals [member target_value].
## The parent invader should call queue_free() or play a death animation.
signal shield_broken

## Emitted (server-only) when [param projectile_value] does NOT match [member target_value].
## [param penalty_multiplier] is the factor by which the invader's speed increases.
## The parent invader applies this to its speed variable.
signal wrong_answer_absorbed(penalty_multiplier: float)

# ---------------------------------------------------------------------------
# Exported properties (Designer-facing, Inspector-configurable)
# ---------------------------------------------------------------------------

## The correct answer for this invader's math question.
## Set by the spawner / game manager on the server before the invader is visible.
@export var target_value: int = 0

## Multiplier applied to the invader's base speed on a wrong answer.
## 1.3 = 30% faster per wrong hit — accumulates each time a wrong shot lands.
@export_range(1.0, 3.0, 0.01) var elastic_penalty: float = 1.3

# ---------------------------------------------------------------------------
# Private state
# ---------------------------------------------------------------------------

## Number of wrong answers absorbed so far in this session.
## Tracked server-side for analytics / difficulty scaling.
var _wrong_hits: int = 0

## True once shield_broken has been emitted — prevents double-processing.
var _is_broken: bool = false

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

func _ready() -> void:
	# Sanity assertion: target_value should always be set before the invader
	# enters the scene tree.  Failing here is a designer/server bug, not a player bug.
	if OS.is_debug_build():
		assert(target_value != 0, \
			"MathShieldComponent: target_value is 0 — did the spawner forget to set it?")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Called by a projectile when it collides with this invader.
## [param projectile_value] is the number displayed on the laser/bullet.
##
## SERVER-ONLY: If called on a client, this function returns immediately.
## Clients must send an RPC to the server to trigger this call,
## never invoke it directly.
func evaluate_hit(projectile_value: int) -> void:
	# === AUTHORITY GUARD — Critical: never remove this. ===
	# All math evaluation happens on the server (Peer ID 1).
	# Clients send a request RPC; the server calls this; results are broadcast.
	if not multiplayer.is_server():
		return

	# Double-processing guard — once broken, ignore further hits.
	if _is_broken:
		return

	if projectile_value == target_value:
		_is_broken = true
		print("MathShieldComponent: CORRECT! Shield broken (answer=%d)." % target_value)
		shield_broken.emit()
	else:
		_wrong_hits += 1
		var accumulated_penalty: float = pow(elastic_penalty, float(_wrong_hits))
		print("MathShieldComponent: WRONG. answer=%d hit=%d penalty=%.2f" \
				% [target_value, projectile_value, accumulated_penalty])
		wrong_answer_absorbed.emit(accumulated_penalty)


## Resets the component so it can be reused by a pooled invader.
## Call this on the server before re-assigning target_value.
func reset(new_target: int) -> void:
	if not multiplayer.is_server():
		return
	target_value = new_target
	_wrong_hits = 0
	_is_broken = false


## Returns the number of wrong answers absorbed (server-side analytics).
func get_wrong_hit_count() -> int:
	return _wrong_hits


## Returns true if this shield has already been broken this round.
func is_broken() -> bool:
	return _is_broken
