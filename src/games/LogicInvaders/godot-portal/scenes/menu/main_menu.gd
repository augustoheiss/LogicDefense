## main_menu.gd
## Scene: scenes/menu/MainMenu.tscn
## Root node type: Control  (CanvasLayer → VBoxContainer for responsive UI)
##
## Responsibility: Entry point for all players (web and Android).
##   - Detects platform and hides "Host" button on web exports.
##   - Wires Host/Join buttons to NetworkManager.
##   - On Host: starts the server, then loads the LogicInvaders game scene
##     via MultiplayerSpawner so all connected peers receive it automatically.
##   - On Join: establishes the WebSocket connection, then waits for the server
##     to spawn the game scene (no scene load on client side — MultiplayerSpawner
##     handles scene replication to clients automatically).
##
## Scene tree expected layout (MainMenu.tscn):
##   MainMenu (Control)
##   └── VBoxContainer
##       ├── TitleLabel         (Label)
##       ├── HostButton         (Button)      → hidden on web
##       ├── JoinButton         (Button)
##       ├── URLLineEdit        (LineEdit)    → URL input, shown when joining
##       ├── StatusLabel        (Label)       → feedback to player
##       └── MultiplayerSpawner               → registered scenes listed below
##
## MultiplayerSpawner setup (configure in editor):
##   - Spawn Path: ".."  (siblings of MainMenu, i.e. the scene's root)
##   - Auto Spawn List:
##       [0] res://scenes/games/logic_invaders/LogicInvaders.tscn
##   This allows the HOST to call `add_child(game_scene)` and ALL connected
##   clients automatically receive the scene without any client-side load call.
##
## Strict typing: Every variable, parameter, and return type is explicit.

extends Control

# ---------------------------------------------------------------------------
# Node references (resolved in _ready via @onready)
# ---------------------------------------------------------------------------

@onready var host_button: Button = $VBoxContainer/HostButton
@onready var join_button: Button = $VBoxContainer/JoinButton
@onready var url_line_edit: LineEdit = $VBoxContainer/URLLineEdit
@onready var status_label: Label = $VBoxContainer/StatusLabel
@onready var game_spawner: MultiplayerSpawner = $MultiplayerSpawner

# ---------------------------------------------------------------------------
# Private state
# ---------------------------------------------------------------------------

## Preloaded game scene — only instantiated on the SERVER.
## Clients receive it automatically via MultiplayerSpawner.
const LOGIC_INVADERS_SCENE: PackedScene = \
	preload("res://scenes/games/logic_invaders/LogicInvaders.tscn")

## Tracks whether we're waiting for the network handshake to complete.
var _connecting: bool = false

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

func _ready() -> void:
	_configure_ui_for_platform()
	_connect_network_signals()
	url_line_edit.text = NetworkManager.DEFAULT_HOST_URL
	status_label.text = "Welcome to Logic Invaders!"


# ---------------------------------------------------------------------------
# Platform-aware UI setup
# ---------------------------------------------------------------------------

func _configure_ui_for_platform() -> void:
	# Web browsers cannot host WebSocket servers (no port binding from JS context).
	# Hide the Host button and auto-show the URL input so the web player must join.
	if OS.has_feature("web"):
		host_button.visible = false
		url_line_edit.visible = true
		url_line_edit.placeholder_text = "ws://server-ip:7777"
		status_label.text = "Enter the host URL and press Join."
	else:
		# Desktop/Android: show both options. URL input hidden until Join is pressed.
		url_line_edit.visible = false


# ---------------------------------------------------------------------------
# NetworkManager signal wiring
# ---------------------------------------------------------------------------

func _connect_network_signals() -> void:
	NetworkManager.hosting_started.connect(_on_hosting_started)
	NetworkManager.join_succeeded.connect(_on_join_succeeded)
	NetworkManager.peer_connected.connect(_on_peer_connected)
	NetworkManager.network_error.connect(_on_network_error)


# ---------------------------------------------------------------------------
# Button callbacks  (connected via the editor's Node dock)
# ---------------------------------------------------------------------------

## Called when the player presses "Host Server".
## Starts the WebSocket server, then immediately spawns the game scene so
## the host can begin playing while they wait for others to join.
func _on_host_button_pressed() -> void:
	if _connecting:
		return
	_set_ui_busy(true)
	status_label.text = "Starting server…"

	var err: Error = NetworkManager.host_game(NetworkManager.DEFAULT_PORT)
	if err != OK:
		_set_ui_busy(false)
		# NetworkManager already emitted network_error; _on_network_error handles UI.


## Called when the player presses "Join Server".
## Reveals the URL input (desktop) and initiates the WebSocket connection.
## Once join_succeeded fires, the server's MultiplayerSpawner delivers the game scene.
func _on_join_button_pressed() -> void:
	if _connecting:
		return

	# Show URL input on desktop if it was hidden.
	if not OS.has_feature("web"):
		url_line_edit.visible = true
		if url_line_edit.text.strip_edges().is_empty():
			status_label.text = "Enter a server URL above."
			return

	_set_ui_busy(true)
	var url: String = url_line_edit.text.strip_edges()
	status_label.text = "Connecting to %s …" % url

	var err: Error = NetworkManager.join_game(url)
	if err != OK:
		_set_ui_busy(false)


# ---------------------------------------------------------------------------
# NetworkManager event handlers
# ---------------------------------------------------------------------------

## Fires on the HOST only once the WebSocket server is listening.
func _on_hosting_started(port: int) -> void:
	status_label.text = "Hosting on port %d — waiting for players…" % port
	_launch_game_scene_as_host()


## Fires on CLIENTS once the WebSocket handshake is complete.
## Clients do NOT load the scene themselves — MultiplayerSpawner delivers it.
func _on_join_succeeded() -> void:
	status_label.text = "Connected! Waiting for host to start the match…"
	# The MultiplayerSpawner on the server will replicate the LogicInvaders scene
	# to this client automatically. No scene load call needed here.


## Fires on BOTH server and clients when any peer joins.
func _on_peer_connected(peer_id: int) -> void:
	if multiplayer.is_server():
		status_label.text = "Player %d joined. Players in lobby: %d" \
			% [peer_id, multiplayer.get_peers().size() + 1] # +1 for host


## Fires on any network failure.
func _on_network_error(reason: String) -> void:
	status_label.text = "Error: " + reason
	_set_ui_busy(false)


# ---------------------------------------------------------------------------
# Scene transition (HOST only)
# ---------------------------------------------------------------------------

## Instantiates and adds the LogicInvaders scene as a child of the root.
## Because a MultiplayerSpawner is configured with spawn_path pointing here,
## Godot automatically replicates this add_child() to ALL connected clients.
##
## IMPORTANT: This must be called AFTER multiplayer.multiplayer_peer is assigned
## (i.e., after host_game() succeeds) — MultiplayerSpawner requires an active peer.
func _launch_game_scene_as_host() -> void:
	if not multiplayer.is_server():
		push_error("MainMenu: _launch_game_scene_as_host() called on a non-server peer!")
		return

	# Instantiate the game scene server-side.
	var game_instance: Node = LOGIC_INVADERS_SCENE.instantiate()

	# Name must be deterministic and clash-free so peers resolve the same node path.
	game_instance.name = "LogicInvaders"

	# Adding to the scene tree here triggers MultiplayerSpawner auto-replication.
	# All connected clients will receive and instantiate this scene automatically.
	get_tree().root.add_child(game_instance)

	# Transition the host's own UI out of the menu.
	_transition_to_game()


## Hides the menu UI on the host once the game scene is loaded.
## Clients: this is called from within the spawned game scene's _ready().
func _transition_to_game() -> void:
	# Hide or free the menu — the game scene takes over.
	# Using hide() instead of queue_free() so the player can return to menu later.
	hide()

# ---------------------------------------------------------------------------
# UI state helpers
# ---------------------------------------------------------------------------

func _set_ui_busy(busy: bool) -> void:
	_connecting = busy
	host_button.disabled = busy
	join_button.disabled = busy
	url_line_edit.editable = not busy
