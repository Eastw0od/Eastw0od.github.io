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
    // Separate the resolved disk from optical scatter: the narrow halo softens
    // bright filaments while the wider levels illuminate the surrounding sky.
    vec3 hdr=base*0.92+0.24*b0+0.14*b1;
    // A restrained champagne palette with a soft highlight shoulder.
    float energy=dot(hdr,vec3(0.26,0.60,0.14));
    float brightness=1.0-exp(-energy*1.05);
    vec3 amber=vec3(0.90,0.61,0.32);
    vec3 ivory=vec3(1.0,0.96,0.87);
    vec3 col=brightness*mix(amber,ivory,smoothstep(0.025,0.55,brightness));
    vec2 p=(gl_FragCoord.xy-uCenter*uResolution)/uResolution.y;
    float holeMask=smoothstep(0.093,0.102,length(p));
    float flare=dot(0.52*b2+0.42*b3,vec3(0.26,0.60,0.14));
    float glow=1.0-exp(-flare*1.35);
    // Suppress broad scatter inside the silhouette without erasing the disk
    // crossing in front of it. Preserve detail by rolling off near highlights.
    col+=mix(amber,ivory,0.28)*glow*(1.0-brightness)*mix(0.035,1.0,holeMask);
    col*=0.988+0.024*hash21(gl_FragCoord.xy);
    col*=1.0-0.16*smoothstep(0.48,0.78,length(uv-0.5));
    vec2 edge=min(uv,1.0-uv);
    float fade=smoothstep(0.0,0.14,min(edge.x,edge.y));
    col=clamp(col,0.0,1.0)*fade;
    // Output premultiplied light. The shadow still occludes the background stars.
    float alpha=max(max(col.r,max(col.g,col.b)),(1.0-holeMask)*fade);
    fragColor=vec4(col,alpha);
}
