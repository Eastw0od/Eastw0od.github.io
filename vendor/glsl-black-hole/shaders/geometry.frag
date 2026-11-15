#version 330
// Optical map adapted from the original Schwarzschild ray integrator.
// The reusable ray table is indexed by impact parameter and orbital angle.
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uTilt;
uniform float uScale;
uniform float uInclination;
uniform float uAzimuth;
uniform float uInner;
uniform vec4 uImpactBreaks;
uniform float uMaxAngle;
uniform sampler2D uRays;
layout(location=0) out vec4 map0;
layout(location=1) out vec4 map1;
layout(location=2) out vec4 map2;

const float PI = 3.14159265359;

float impactIndex(float b) {
    if (b < uImpactBreaks.y) return b / uImpactBreaks.y;
    if (b < uImpactBreaks.z) return 1.0 + (b - uImpactBreaks.y) / (uImpactBreaks.z - uImpactBreaks.y);
    return 2.0 + (b - uImpactBreaks.z) / (uImpactBreaks.w - uImpactBreaks.z);
}

float rayRadius(float column, float orbitAngle, ivec2 dimensions) {
    vec2 cell = vec2(column, orbitAngle / uMaxAngle * float(dimensions.y - 1));
    cell = clamp(cell, vec2(0.0), vec2(dimensions - 1) - 0.001);
    ivec2 pixel = ivec2(cell);
    vec2 f = fract(cell);
    float a = mix(texelFetch(uRays, pixel, 0).r,
                  texelFetch(uRays, pixel + ivec2(1, 0), 0).r, f.x);
    float b = mix(texelFetch(uRays, pixel + ivec2(0, 1), 0).r,
                  texelFetch(uRays, pixel + ivec2(1, 1), 0).r, f.x);
    return 1.0 / max(0.01, mix(a, b, f.y));
}

void main() {
    vec2 p = (gl_FragCoord.xy - uCenter * uResolution) / uResolution.y;
    float c = cos(uTilt), s = sin(uTilt);
    p = mat2(c, -s, s, c) * p * uScale;
    map0 = vec4(0.0);
    map1 = vec4(0.0);
    map2 = vec4(0.0);
    float impact = length(p);
    if (impact < 0.01 || impact >= uImpactBreaks.w) return;

    // Preserve the upstream scene's slight compression below the photon ring.
    float compression = smoothstep(0.3, 1.5, -p.y) * (1.0 - smoothstep(5.0, 7.0, impact));
    impact += max(0.0, impact - 2.598) * 0.30 * compression;

    vec3 axis = vec3(sin(uAzimuth) * cos(uInclination), sin(uInclination), cos(uAzimuth) * cos(uInclination));
    vec3 right = vec3(cos(uAzimuth), 0.0, -sin(uAzimuth));
    vec3 up = cross(axis, right);
    vec3 radial = normalize(p.x * right + p.y * up);

    // The ray plane meets the disk along an axis with two opposite directions.
    float crossing = mod(atan(-axis.y, radial.y), PI);
    if (crossing < atan(impact / 80.0)) crossing += PI;
    ivec2 dimensions = textureSize(uRays, 0);
    float column = impactIndex(impact) * float(dimensions.x - 1) / 3.0;
    float normalProjection = length(vec2(axis.y, radial.y));
    int hits = 0;
    for (int i = 0; i < 3; i++) {
        if (crossing > uMaxAngle) break;
        float radius = rayRadius(column, crossing, dimensions);
        if (radius > uInner && radius < 34.0) {
            vec3 direction = cos(crossing) * axis + sin(crossing) * radial;
            float incidence = impact / radius * normalProjection;
            vec4 data = vec4(radius, atan(direction.z, direction.x), incidence, 1.0);
            if (hits == 0) map0 = data;
            if (hits == 1) map1 = data;
            if (hits == 2) map2 = data;
            hits++;
        }
        crossing += PI;
    }
}
