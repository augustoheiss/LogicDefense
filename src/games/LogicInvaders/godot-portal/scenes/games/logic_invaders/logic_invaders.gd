## logic_invaders.gd
## Scene: scenes/games/logic_invaders/LogicInvaders.tscn
## Root node type: Node2D
##
## Responsibility: The master game coordinator for Logic Invaders.
##   - On the server: spawns Player nodes for every connected peer.
##   - On the server: runs an invader spawn timer and populates InvadersContainer.
##   - MultiplayerSpawner nodes on PlayersContainer and InvadersContainer
##     automatically replicate all spawns, moves, and despawns to clients.
##   - Clients do nothing in _ready() — they receive everything via replication.
##
## Authority model: Server-only state mutations, guarded by is_server().
##
## Node tree (build in Editor):
##   LogicInvaders (Node2D)             ← this script
##   ├── PlayersContainer (Node)        ← holds Player nodes
##   ├── PlayersSpawner (MultiplayerSpawner)
##   │      spawn_path → PlayersContainer
##   │      auto_spawn_list → [Player.tscn]
##   ├── InvadersContainer (Node)       ← holds Invader nodes
##   ├── InvadersSpawner (MultiplayerSpawner)
##   │      spawn_path → InvadersContainer
##   │      auto_spawn_list → [Invader.tscn]
##   └── SpawnTimer (Timer)             ← server-only invader wave timer

extends Node2D

# ---------------------------------------------------------------------------
# Scene references (preloaded — paths must match your res:// structure)
# ---------------------------------------------------------------------------

const PLAYER_SCENE: PackedScene = \
	preload("res://scenes/games/logic_invaders/Player.tscn")

const INVADER_SCENE: PackedScene = \
	preload("res://scenes/games/logic_invaders/Invader.tscn")

# ---------------------------------------------------------------------------
# Node references
# ---------------------------------------------------------------------------

@onready var players_container: Node = $PlayersContainer
@onready var invaders_container: Node = $InvadersContainer
@onready var players_spawner: MultiplayerSpawner = $PlayersSpawner
@onready var invaders_spawner: MultiplayerSpawner = $InvadersSpawner
@onready var spawn_timer: Timer = $SpawnTimer

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

## Seconds between invader wave spawns.
@export var invader_spawn_interval: float = 3.0

## Number of invaders per row spawn.
@export var invaders_per_wave: int = 3

## Horizontal spacing between invaders in a wave.
@export var invader_spacing: float = 120.0

## Y position (top of screen) where invaders are spawned.
@export var invader_spawn_y: float = -40.0

## Range of math question target values generated for invaders.
@export var math_min: int = 1
@export var math_max: int = 12

# ---------------------------------------------------------------------------
# Private state
# ---------------------------------------------------------------------------

## Running counter used for giving invaders unique names.
var _invader_counter: int = 0

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

func _ready() -> void:
	# Clients do nothing here — all state arrives via MultiplayerSpawner replication.
	if not multiplayer.is_server():
		return

	print("LogicInvaders: Server ready. Spawning players…")

	# === SPAWN PLAYERS ===
	# Gather all connected peer IDs. We must also spawn for peer 1 (the host player).
	# multiplayer.get_peers() returns connected CLIENT IDs — peer 1 (host) is excluded.
	var all_peer_ids: Array[int] = []
	all_peer_ids.append(1)  # Host player always gets a ship.
	for peer_id: int in multiplayer.get_peers():
		all_peer_ids.append(peer_id)

	for peer_id: int in all_peer_ids:
		_spawn_player_for_peer(peer_id)

	# === CONNECT FUTURE JOINS ===
	# If a player joins AFTER _ready(), spawn them on the fly.
	NetworkManager.peer_connected.connect(_on_late_peer_connected)
	NetworkManager.peer_disconnected.connect(_on_peer_disconnected)

	# === START INVADER TIMER ===
	spawn_timer.wait_time = invader_spawn_interval
	spawn_timer.timeout.connect(_on_spawn_timer_timeout)
	spawn_timer.start()

	# Spawn the first wave immediately so the game doesn't feel empty at start.
	_spawn_invader_wave()

# ---------------------------------------------------------------------------
# Player spawning
# ---------------------------------------------------------------------------

## Instantiates a Player node for [param peer_id] and adds it to PlayersContainer.
## Naming the node str(peer_id) is CRITICAL — Player._ready() uses name.to_int()
## to call set_multiplayer_authority(peer_id), binding movement input to that peer.
func _spawn_player_for_peer(peer_id: int) -> void:
	var player: Player = PLAYER_SCENE.instantiate() as Player
	if player == null:
		push_error("LogicInvaders: PLAYER_SCENE did not instantiate as Player.")
		return

	# === CRITICAL: Name must equal peer_id as string ===
	# Player._ready() calls name.to_int() to set_multiplayer_authority().
	# If this is wrong, authority is set to 0 (invalid) and nobody can move.
	player.name = str(peer_id)

	# Spread ships horizontally based on the peer's index in the list.
	var all_peers: Array = [1] + multiplayer.get_peers()
	var index: int = all_peers.find(peer_id)
	var viewport_width: float = get_viewport_rect().size.x
	var slot_width: float = viewport_width / float(max(all_peers.size(), 1))
	player.global_position = Vector2(
		slot_width * float(index) + slot_width * 0.5,
		get_viewport_rect().size.y - 80.0
	)

	# add_child() on a MultiplayerSpawner-managed container replicates to clients.
	players_container.add_child(player)
	print("LogicInvaders: Spawned Player '%s' at %s." % [player.name, player.global_position])


func _on_late_peer_connected(peer_id: int) -> void:
	if not multiplayer.is_server():
		return
	print("LogicInvaders: Late join — spawning player for peer %d." % peer_id)
	_spawn_player_for_peer(peer_id)


func _on_peer_disconnected(peer_id: int) -> void:
	if not multiplayer.is_server():
		return
	var player_node: Node = players_container.get_node_or_null(str(peer_id))
	if player_node != null:
		player_node.queue_free()
		print("LogicInvaders: Removed player for disconnected peer %d." % peer_id)

# ---------------------------------------------------------------------------
# Invader spawning
# ---------------------------------------------------------------------------

func _on_spawn_timer_timeout() -> void:
	if not multiplayer.is_server():
		return
	_spawn_invader_wave()


## Spawns a horizontal row of [member invaders_per_wave] invaders at the top.
## Each invader receives a unique random math question from the configured range.
func _spawn_invader_wave() -> void:
	var viewport_width: float = get_viewport_rect().size.x
	var total_wave_width: float = invader_spacing * float(invaders_per_wave - 1)
	var start_x: float = (viewport_width - total_wave_width) * 0.5

	for i: int in range(invaders_per_wave):
		var invader: Invader = INVADER_SCENE.instantiate() as Invader
		if invader == null:
			push_error("LogicInvaders: INVADER_SCENE did not instantiate as Invader.")
			continue

		_invader_counter += 1
		invader.name = "Invader_%d" % _invader_counter

		# Assign the math question BEFORE add_child() — Invader._ready() asserts
		# target_value != 0 in debug builds, so it must be set beforehand.
		invader.math_shield.target_value = randi_range(math_min, math_max)
		invader.question_text = "= %d" % invader.math_shield.target_value  # Sprint 3: show question expression

		invader.global_position = Vector2(
			start_x + invader_spacing * float(i),
			invader_spawn_y
		)

		# add_child() inside InvadersContainer triggers MultiplayerSpawner replication.
		invaders_container.add_child(invader)

	print("LogicInvaders: Spawned wave of %d invaders (total: %d)." \
		% [invaders_per_wave, _invader_counter])
