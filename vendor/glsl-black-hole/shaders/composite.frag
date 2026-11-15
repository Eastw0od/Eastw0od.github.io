#version 330
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uTilt;
uniform float uTime;
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
vec3 stars(vec2 uv) {
    vec2 p=uv*280.0;
    vec2 id=floor(p),f=fract(p);
    float h=hash21(id+37.1);
    vec2 pos=0.15+0.7*vec2(hash21(id+11.1),hash21(id+89.3));
    vec2 d=(f-pos)*960.0/280.0;
    d.x+=d.y*0.28;
    float light=exp(-dot(d*vec2(1.3,0.82),d*vec2(1.3,0.82))*2.8);
    float density=step(0.984,h);
    float bright=0.028+0.16*pow(hash21(id+78.9),3.0);
    return light*density*bright*vec3(0.96,0.93,0.91);
}
void main() {
    vec2 uv=gl_FragCoord.xy/uResolution;
    vec3 base=texture(uEmission,uv).rgb;
    vec3 b0=texture(uBloom0,uv).rgb;
    vec3 b1=texture(uBloom1,uv).rgb;
    vec3 b2=texture(uBloom2,uv).rgb;
    vec3 b3=texture(uBloom3,uv).rgb;
    vec3 hdr=base*0.96+0.13*b0+0.035*b1;
    // Eastwood homepage color grade: cyan on the approaching side, rose on the far side.
    vec3 col=1.0-exp(-hdr*0.95);
    vec2 p=(gl_FragCoord.xy-uCenter*uResolution)/uResolution.y;
    float co=cos(uTilt),si=sin(uTilt);
    vec2 q=mat2(co,-si,si,co)*p;
    float blue=dot(b2,vec3(0.3,0.5,0.2))*0.085+dot(b3,vec3(0.3,0.5,0.2))*0.18;
    blue+=0.205*exp(-dot(q/vec2(0.235,0.16),q/vec2(0.235,0.16)));
    float planeHaze=0.35*exp(-pow(q.x/0.35,4.0)-pow(q.y/0.068,2.0));
    planeHaze*=(1.0-exp(-pow(q.x/0.14,2.0)))*(0.7+0.4*tanh(q.x*6.0));
    blue+=planeHaze;
    float side=smoothstep(-0.20,0.21,q.x);
    vec3 tint=mix(vec3(0.23,0.67,0.83),vec3(0.83,0.34,0.66),side);
    tint=mix(tint,vec3(0.49,0.33,0.80),0.31*(1.0-smoothstep(0.0,0.17,q.y)));
    float energy=dot(col,vec3(0.24,0.62,0.14));
    col=energy*tint*1.36+vec3(0.85,0.86,0.92)*pow(energy,3.0)*0.55;
    col+=tint*blue*0.62*pow(max(0.0,1.0-max(col.r,max(col.g,col.b))),0.8);
    col*=0.89+0.22*hash21(gl_FragCoord.xy);
    float holeMask=smoothstep(0.093,0.102,length(p));
    col+=stars(uv)*holeMask;
    col*=1.0-0.16*smoothstep(0.48,0.78,length(uv-0.5));
    vec2 edge=min(uv,1.0-uv);
    col*=smoothstep(0.0,0.14,min(edge.x,edge.y));
    fragColor=vec4(clamp(col,0.0,1.0),1.0);
}
