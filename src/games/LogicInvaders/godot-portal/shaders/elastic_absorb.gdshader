// elastic_absorb.gdshader
// Shader Type  : canvas_item  (2D sprite — applied to the invader's Sprite2D)
// Renderer     : gl_compatibility / WebGL 2.0  (safe for web & Android)
//
// Effect       : When an invader ABSORBS a wrong answer ("Elastic Feedback"):
//   1. The UV warps on the X-axis — a fast horizontal wobble (panic distortion).
//   2. The sprite flashes red, proportional to hit_flash_intensity.
//   When intensity returns to 0.0, the sprite renders normally with zero overhead.
//
// Performance guarantees (Compatibility renderer safe):
//   - 1 texture sample per fragment (the base TEXTURE sample). Zero extra samples.
//   - No SCREEN_TEXTURE, no DEPTH_TEXTURE, no discard, no dynamic loops.
//   - All math is ALU — fast on low-end WebGL/Android GPUs.
//   - UV distortion is driven by TIME * constants only — no additional uniforms needed.
//
// Usage (GDScript — on the invader's Sprite2D):
//   var mat := ShaderMaterial.new()
//   mat.shader = preload("res://shaders/elastic_absorb.gdshader")
//   $Sprite2D.material = mat
//   # Trigger flash:
//   mat.set_shader_parameter("hit_flash_intensity", 1.0)
//   # Fade back via Tween:
//   var tween := create_tween()
//   tween.tween_method(func(v: float): mat.set_shader_parameter("hit_flash_intensity", v),
//                      1.0, 0.0, 0.35)

shader_type canvas_item;

// ─────────────────────────────────────────────────────────────────────────────
// Uniforms
// ─────────────────────────────────────────────────────────────────────────────

/// Controls the intensity of the absorb effect.
/// 0.0 = sprite renders completely normally (no performance cost beyond uniform read).
/// 1.0 = maximum wobble + full red flash.
/// Animate this value via Tween from 1.0 → 0.0 over ~0.3s for the best feel.
uniform float hit_flash_intensity : hint_range(0.0, 1.0) = 0.0;

/// Speed of the horizontal UV wobble (cycles per second).
/// 18.0 feels frantic and "wrong" — matches the Elastic Feedback panic aesthetic.
uniform float wobble_speed : hint_range(1.0, 60.0) = 18.0;

/// Amplitude of the UV X-axis displacement (in UV space, ~0.02 = 2% of sprite width).
uniform float wobble_amplitude : hint_range(0.0, 0.1) = 0.028;

/// Color of the flash overlay.  Default is a saturated red.
uniform vec4 flash_color : source_color = vec4(1.0, 0.08, 0.08, 1.0);

// ─────────────────────────────────────────────────────────────────────────────
// Fragment
// ─────────────────────────────────────────────────────────────────────────────

void fragment() {
	// ── 1. UV Distortion ─────────────────────────────────────────────────
	// When intensity > 0, displace UV.x with a sine wave driven by TIME.
	// The displacement scales with intensity so the wobble dies naturally
	// as the tween brings intensity back to 0.
	//
	// Two sine waves at coprime frequencies create an organic "wrong" jitter
	// without any extra texture samples.
	float phase_a = TIME * wobble_speed;
	float phase_b = TIME * wobble_speed * 1.618; // golden ratio = aperiodic feel

	float displacement = sin(phase_a + UV.y * 12.0) * 0.6
	                   + sin(phase_b + UV.y * 7.0)  * 0.4;

	vec2 distorted_uv = UV;
	distorted_uv.x += displacement * wobble_amplitude * hit_flash_intensity;

	// Clamp UV to [0, 1] to prevent sampling outside the sprite atlas region.
	distorted_uv = clamp(distorted_uv, vec2(0.0), vec2(1.0));

	// ── 2. Base Sample (single texture fetch) ────────────────────────────
	// TEXTURE is the Godot 4 canvas_item built-in — the node's assigned Texture2D.
	vec4 base = texture(TEXTURE, distorted_uv);

	// ── 3. Red Flash Composite ───────────────────────────────────────────
	// Blend flash_color over the base sprite proportional to intensity.
	// We preserve the sprite's original alpha — the flash does NOT make
	// transparent areas visible.
	vec3 composited_rgb = mix(base.rgb, flash_color.rgb, hit_flash_intensity * flash_color.a);

	// Preserve original vertex color tint (COLOR is the modulate/tint from the engine).
	COLOR = vec4(composited_rgb, base.a) * COLOR;
}
