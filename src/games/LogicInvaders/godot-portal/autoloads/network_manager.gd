## NetworkManager.gd
## Global Autoload: Cross-scene multiplayer session manager using WebSocketMultiplayerPeer.
##
## Responsibility: Owns every aspect of the network connection lifecycle.
##   - On Web/Android CLIENTS: calls join_game() to connect to a host via WebSocket URL.
##   - On a DEDICATED HOST (non-web): calls host_game() to open a WebSocketServer.
##   - Emits typed signals so any scene can react to join/leave events without polling.
##
## Lifetime: Persists for the entire application session (Autoload).
## Cleanup: Call disconnect_network() before scene transitions to avoid dangling peers.
##
## Authority model: Peer ID 1 is ALWAYS the server/host. All game-state mutations
## must be gated with  `if not multiplayer.is_server(): return`  in game scripts.
##
## Register in project.godot:
##   [autoload]
##   NetworkManager="*res://autoloads/network_manager.gd"

extends Node

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

## Default WebSocket port. Must match the host configuration.
const DEFAULT_PORT: int = 7777

## Maximum simultaneous client connections (excluding the server itself).
const MAX_CLIENTS: int = 8

## URL scheme used when the host is on the same LAN (dev default).
const DEFAULT_HOST_URL: String = "ws://127.0.0.1:7777"

# ---------------------------------------------------------------------------
# Signals  (GDScript: snake_case, all typed parameters)
# ---------------------------------------------------------------------------

## Emitted on BOTH the server and existing clients when a new peer joins.
signal peer_connected(peer_id: int)

## Emitted on BOTH the server and remaining clients when a peer drops.
signal peer_disconnected(peer_id: int)

## Emitted only on clients when the server closes or the connection drops.
signal server_disconnected

## Emitted when the host_game() call succeeds. Carries the listen port.
signal hosting_started(port: int)

## Emitted when join_game() succeeds and the WebSocket handshake completes.
signal join_succeeded

## Emitted when any network operation fails. Carries a human-readable reason.
signal network_error(reason: String)

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

## Cached peer reference — kept so we can close it cleanly.
var _peer: WebSocketMultiplayerPeer = null

## True once the local node is acting as the WebSocket server.
var _is_hosting: bool = false

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

func _ready() -> void:
	# Wire Godot's built-in MultiplayerAPI signals to our typed wrappers.
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.server_disconnected.connect(_on_server_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_to_server)

	# === WEB PLATFORM GUARD ===
	# Browsers cannot bind a raw TCP/WebSocket server (no port-listening from JS).
	# Web exports must ALWAYS join an external host — never try to host themselves.
	# The menu UI should hide the "Host" button for web clients, but we also
	# enforce it here as a safeguard.
	if OS.has_feature("web"):
		push_warning("NetworkManager: Running on Web — host_game() is disabled. Use join_game().")

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

## Opens a WebSocket server on [param port].
## Should only be called from non-web platforms (desktop/dedicated server).
## Returns [code]OK[/code] on success, or an [enum Error] code on failure.
func host_game(port: int = DEFAULT_PORT) -> Error:
	if OS.has_feature("web"):
		var msg: String = "host_game() is not supported on web. Call join_game() instead."
		push_error("NetworkManager: " + msg)
		network_error.emit(msg)
		return ERR_UNAVAILABLE

	if _peer != null:
		push_warning("NetworkManager: Already connected. Disconnecting before re-hosting.")
		disconnect_network()

	_peer = WebSocketMultiplayerPeer.new()
	var err: Error = _peer.create_server(port)
	if err != OK:
		var msg: String = "Failed to create WebSocket server on port %d. Error: %s" % [port, error_string(err)]
		push_error("NetworkManager: " + msg)
		network_error.emit(msg)
		_peer = null
		return err

	multiplayer.multiplayer_peer = _peer
	_is_hosting = true
	hosting_started.emit(port)
	print("NetworkManager: Hosting on ws://0.0.0.0:%d" % port)
	return OK


## Connects to a WebSocket host at [param url].
## Example URL: "ws://192.168.1.10:7777"
## Web clients MUST use this path.
## Returns [code]OK[/code] on success, or an [enum Error] code on failure.
func join_game(url: String = DEFAULT_HOST_URL) -> Error:
	if _peer != null:
		push_warning("NetworkManager: Already connected. Disconnecting before re-joining.")
		disconnect_network()

	_peer = WebSocketMultiplayerPeer.new()
	var err: Error = _peer.create_client(url)
	if err != OK:
		var msg: String = "Failed to connect to '%s'. Error: %s" % [url, error_string(err)]
		push_error("NetworkManager: " + msg)
		network_error.emit(msg)
		_peer = null
		return err

	multiplayer.multiplayer_peer = _peer
	print("NetworkManager: Connecting to %s …" % url)
	return OK


## Cleanly shuts down the current network session.
## Safe to call even if not connected.
func disconnect_network() -> void:
	if _peer != null:
		_peer.close()
		_peer = null

	multiplayer.multiplayer_peer = null
	_is_hosting = false
	print("NetworkManager: Disconnected.")


## Returns [code]true[/code] if this instance is acting as the WebSocket host.
func is_hosting() -> bool:
	return _is_hosting


## Returns the local peer ID assigned by the MultiplayerAPI.
## Peer ID 1 = server/host. All other IDs are clients.
func get_local_peer_id() -> int:
	return multiplayer.get_unique_id()

# ---------------------------------------------------------------------------
# Private signal handlers
# ---------------------------------------------------------------------------

func _on_peer_connected(peer_id: int) -> void:
	print("NetworkManager: Peer %d connected." % peer_id)
	peer_connected.emit(peer_id)


func _on_peer_disconnected(peer_id: int) -> void:
	print("NetworkManager: Peer %d disconnected." % peer_id)
	peer_disconnected.emit(peer_id)


func _on_server_disconnected() -> void:
	push_warning("NetworkManager: Server disconnected unexpectedly.")
	server_disconnected.emit()
	disconnect_network()


func _on_connected_to_server() -> void:
	print("NetworkManager: Successfully joined server as peer %d." % multiplayer.get_unique_id())
	join_succeeded.emit()

# ---------------------------------------------------------------------------
# _process — required for WebSocketMultiplayerPeer to poll incoming packets
# ---------------------------------------------------------------------------

func _process(_delta: float) -> void:
	# WebSocketMultiplayerPeer does NOT auto-poll — we must drive it every frame.
	if _peer != null and _peer.get_connection_status() == MultiplayerPeer.CONNECTION_CONNECTED:
		_peer.poll()
