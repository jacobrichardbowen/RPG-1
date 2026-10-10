// Sea surface: scrolling normal map, fresnel sky reflection, sun glint, depth tint and shore foam.
import * as THREE from 'three';
import { TERRAIN_HALF } from './terrain.js';
import { MARSH } from './layout.js';

export function createWater(normalTex, heightTex, sky) {
  const geo = new THREE.PlaneGeometry(5000, 5000, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uTime: { value: 0 },
    tNormal: { value: null },
    tHeight: { value: null },
    uHalf: { value: TERRAIN_HALF },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uNight: { value: 0 },
    uDeep: { value: new THREE.Color(0x0e3a48) },
    uShallow: { value: new THREE.Color(0x3a8a86) },
    uMarsh: { value: new THREE.Vector3(MARSH.x, MARSH.z, MARSH.radius) },
  }]);
  uniforms.tNormal.value = normalTex;
  uniforms.tHeight.value = heightTex;
  const mat = new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    transparent: true,
    vertexShader: `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float uTime, uHalf, uNight;
      uniform sampler2D tNormal, tHeight;
      uniform vec3 uSunDir, uSunColor, uZenith, uHorizon, uDeep, uShallow, uMarsh;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main() {
        vec2 p = vWorld.xz;
        vec3 n1 = texture2D(tNormal, p * 0.031 + vec2(uTime * 0.011, uTime * 0.007)).xyz * 2.0 - 1.0;
        vec3 n2 = texture2D(tNormal, p * 0.067 + vec2(-uTime * 0.009, uTime * 0.013)).xyz * 2.0 - 1.0;
        vec3 n3 = texture2D(tNormal, p * 0.0071 + vec2(uTime * 0.002, -uTime * 0.003)).xyz * 2.0 - 1.0;
        vec2 nxy = n1.xy * 0.5 + n2.xy * 0.35 + n3.xy * 0.6;
        vec3 N = normalize(vec3(nxy.x, 3.2, nxy.y));
        vec3 V = normalize(cameraPosition - vWorld);
        float dist = length(cameraPosition - vWorld);
        N = normalize(mix(N, vec3(0.0, 1.0, 0.0), smoothstep(80.0, 600.0, dist)));
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        vec3 skyCol = mix(uHorizon, uZenith, pow(max(R.y, 0.0), 0.6));
        // Depth from terrain heights.
        vec2 huv = (p + uHalf) / (2.0 * uHalf);
        float th = -24.0;
        if (huv.x > 0.0 && huv.x < 1.0 && huv.y > 0.0 && huv.y < 1.0) th = texture2D(tHeight, huv).r;
        float depth = max(0.0, -th);
        float marshF = 1.0 - smoothstep(uMarsh.z * 0.55, uMarsh.z * 1.05, length(p - uMarsh.xy));
        vec3 body = mix(uShallow, uDeep, smoothstep(0.3, 9.0, depth));
        body = mix(body, vec3(0.07, 0.09, 0.05), marshF);
        body *= mix(1.0, 0.25, uNight) * (0.55 + 0.45 * max(uSunDir.y, 0.0));
        vec3 col = mix(body, skyCol, fres * 0.85 * (1.0 - marshF * 0.65));
        float spec = pow(max(dot(R, uSunDir), 0.0), 220.0);
        col += uSunColor * spec * 3.5 * (1.0 - uNight * 0.7);
        col += uSunColor * pow(max(dot(R, uSunDir), 0.0), 18.0) * 0.12;
        // Shore foam bands.
        float shore = 1.0 - smoothstep(0.0, 1.4, depth);
        float wave = sin(depth * 6.0 - uTime * 1.6 + n2.x * 2.5) * 0.5 + 0.5;
        float foam = shore * (0.45 + 0.55 * wave) * smoothstep(0.35, 0.9, n1.y * 0.5 + 0.6);
        foam += (1.0 - smoothstep(0.0, 0.18, depth)) * 0.8;
        foam *= 1.0 - marshF * 0.92;
        col = mix(col, vec3(0.92, 0.95, 0.95) * (1.0 - uNight * 0.75), clamp(foam, 0.0, 1.0) * 0.8);
        float alpha = mix(0.55, 0.96, smoothstep(0.0, 3.0, depth));
        alpha = mix(alpha, 0.9, marshF);
        alpha = max(alpha, fres);
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'water';
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.userData.update = (t, cam) => {
    uniforms.uTime.value = t;
    uniforms.uSunDir.value.copy(sky.lightDir);
    uniforms.uSunColor.value.copy(sky.sunColor);
    uniforms.uZenith.value.copy(sky.zenith);
    uniforms.uHorizon.value.copy(sky.horizon);
    uniforms.uNight.value = sky.nightFactor;
    mesh.position.x = Math.round(cam.x / 50) * 50;
    mesh.position.z = Math.round(cam.z / 50) * 50;
  };
  return mesh;
}
