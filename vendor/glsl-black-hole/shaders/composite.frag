#version 330
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform sampler2D uEmission;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
out vec4 fragColor;
float hash21(vec2 p) {
    vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
}
void main() {
    vec2 uv=gl_FragCoord.xy/uResolution;
    vec3 base=texture(uEmission,uv).rgb;
    vec3 b0=texture(uBloom0,uv).rgb;
    vec3 b1=texture(uBloom1,uv).rgb;
    vec3 b2=texture(uBloom2,uv).rgb;
    vec3 b3=texture(uBloom3,uv).rgb;
    vec3 hdr=base+0.075*b0+0.025*b1;
    // Warm-white filaments and amber shadows inspired by Gargantua.
    float energy=dot(hdr,vec3(0.26,0.60,0.14));
    float brightness=1.0-exp(-energy*1.25);
    vec3 amber=vec3(1.0,0.55,0.28);
    vec3 ivory=vec3(1.0,0.96,0.86);
    vec3 col=brightness*mix(amber,ivory,smoothstep(0.16,0.76,brightness));
    vec2 p=(gl_FragCoord.xy-uCenter*uResolution)/uResolution.y;
    float holeMask=smoothstep(0.093,0.102,length(p));
    float flare=dot(0.07*b2+0.035*b3,vec3(0.26,0.60,0.14));
    col+=amber*flare*(1.0-brightness)*mix(0.2,1.0,holeMask);
    col*=0.98+0.04*hash21(gl_FragCoord.xy);
    col*=1.0-0.16*smoothstep(0.48,0.78,length(uv-0.5));
    vec2 edge=min(uv,1.0-uv);
    float fade=smoothstep(0.0,0.14,min(edge.x,edge.y));
    col=clamp(col,0.0,1.0)*fade;
    // Output premultiplied light. The shadow still occludes the background stars.
    float alpha=max(max(col.r,max(col.g,col.b)),(1.0-holeMask)*fade);
    fragColor=vec4(col,alpha);
}
