/*
*   Alex Rodriguez
*   @jxarco 
*/

function LGraphAtmos()
{
	this.addOutput("Shader","Shader");
	//this.addOutput("Skybox","Skybox");
	this.size[0] = 170;
    
    this.shader_name = "atmos";
    this.shader = gl.shaders[this.shader_name] = new GL.Shader(LGraphAtmos.VS_CODE, LGraphAtmos.FS_CODE);

	this.properties = {
		sunPosition: vec3.fromValues(0, 0.4, -1),
		sunIntensity: 22,
		mieDirection: 0.76,
		originOffset: 0,
		mieCoeff: 21
	}
}

LGraphAtmos.title = "Atmospheric Scatter";

LGraphAtmos.prototype.onExecute = function()
{
	this.setOutputData(0, this.shader_name );
}

Object.defineProperty(LGraphAtmos.prototype, 'sunPosition', {
    get: function() { return this.properties.sunPosition; },
    set: function(v) { 
        this.properties.sunPosition = v; 
        if(CORE)
            CORE.setUniform('SunPos', v);
    }, enumerable: true
});

Object.defineProperty(LGraphAtmos.prototype, 'sunIntensity', {
    get: function() { return this.properties.sunIntensity; },
    set: function(v) { 
        this.properties.sunIntensity = v; 
        if(CORE)
            CORE.setUniform('SunIntensity', v);
    }, enumerable: true
});

Object.defineProperty(LGraphAtmos.prototype, 'mieDirection', {
    get: function() { return this.properties.mieDirection; },
    set: function(v) { 
        this.properties.mieDirection = v; 
        if(CORE)
            CORE.setUniform('MieDirection', v);
    }, enumerable: true
});

Object.defineProperty(LGraphAtmos.prototype, 'originOffset', {
    get: function() { return this.properties.originOffset; },
    set: function(v) { 
        this.properties.originOffset = v; 
        if(CORE)
            CORE.setUniform('originOffset', v);
    }, enumerable: true
});

Object.defineProperty(LGraphAtmos.prototype, 'mieCoeff', {
    get: function() { return this.properties.mieCoeff; },
    set: function(v) { 
        this.properties.mieCoeff = v; 
        if(CORE)
            CORE.setUniform('MieCoeff', v);
    }, enumerable: true
});

/*

// falta prefilter

CORE.cubemapToTexture( function() { CORE.set(":atmos", {no_free_memory: true}) });

*/

LGraphAtmos.ATMOS_CODE = `

    // https://www.scratchapixel.com/lessons/procedural-generation-virtual-worlds/simulating-sky
    // https://developer.nvidia.com/gpugems/GPUGems2/gpugems2_chapter16.html

    #define PI 3.141592
    #define iSteps 16
    #define jSteps 8

    vec2 rsi(vec3 r0, vec3 rd, float sr) {
        // ray-sphere intersection that assumes
        // the sphere is centered at the origin.
        // No intersection when result.x > result.y
        float a = dot(rd, rd);
        float b = 2.0 * dot(rd, r0);
        float c = dot(r0, r0) - (sr * sr);
        float d = (b*b) - 4.0*a*c;
        if (d < 0.0) return vec2(1e5,-1e5);
        return vec2(
            (-b - sqrt(d))/(2.0*a),
            (-b + sqrt(d))/(2.0*a)
        );
    }

    // RayLeigh phase function
    float computeRayleighPhase( float mu )
    {
        return 3.0 / (16.0 * PI) * (1.0 + mu * mu);
    }

    // Mie phase function
    float computeMiePhase( float mu, float g )
    {
        float gg = g * g;
        float a = (1.0 - gg) * (1.0 + mu * mu);
        float b = (2.0 + gg) * pow((1.0 + gg - 2.0 * g * mu), 1.5);

        return 3.0 / (8.0 * PI) * (a / b);
    }

    vec3 getSkyColor(vec3 r, vec3 r0, vec3 pSun, float iSun, float rPlanet, float rAtmos, vec3 kRlh, float kMie, float shRlh, float shMie, float g) {
        // Normalize the sun and view directions.
        pSun = normalize(pSun);
        r = normalize(r);

        //  - Calculate the step size of the primary ray.
        //  - Know the intersection point between the camera ray and the atmosphere
        // 	  so basically: raySphereIntersect(orig, dir, atmosphereRadius)
        vec2 p = rsi(r0, r, rAtmos);
        if (p.x > p.y) return vec3(0,0,0);
        p.y = min(p.y, rsi(r0, r, rPlanet).x);
        float iStepSize = (p.y - p.x) / float(iSteps);

        //  - Calculate the Rayleigh and Mie phases.
        // 	  How much light coming from direction L is scattered in direction V
        float mu = dot(r, pSun);
        float pRlh = computeRayleighPhase(mu);
        float pMie = computeMiePhase(mu, g);

        // Initialize the ray time for each ray
        float iTime = 0.0;
        float jTime = 0.0;

        // Initialize accumulators for Rayleigh and Mie scattering.
        vec3 totalRlh = vec3(0,0,0);
        vec3 totalMie = vec3(0,0,0);

        // Initialize optical depth accumulators for each ray
        float iOdRlh = 0.0;
        float iOdMie = 0.0;
        float jOdRlh = 0.0;
        float jOdMie = 0.0;

        // Sample the primary ray.
        for (int i = 0; i < iSteps; i++) {

            // Calculate the primary ray sample position.
            vec3 iPos = r0 + r * (iTime + iStepSize * 0.5);

            // Calculate the height of the sample.
            float iHeight = length(iPos) - rPlanet;

            // Calculate the optical depth of the Rayleigh and Mie scattering for this step.
            // Using scale height for each scattering type
            float odStepRlh = exp(-iHeight / shRlh) * iStepSize;
            float odStepMie = exp(-iHeight / shMie) * iStepSize;

            // Accumulate optical depth.
            iOdRlh += odStepRlh;
            iOdMie += odStepMie;

            // Calculate the step size of the secondary ray.
            float jStepSize = rsi(iPos, pSun, rAtmos).y / float(jSteps);

            // Sample the secondary ray.
            for (int j = 0; j < jSteps; j++) {

                // Calculate the secondary ray sample position.
                // The origin is the current step of the ray
                // Use r as the sun direction 
                vec3 jPos = iPos + pSun * (jTime + jStepSize * 0.5);

                // Calculate the height of the sample.
                float jHeight = length(jPos) - rPlanet;

                // Accumulate the optical depth.
                jOdRlh += exp(-jHeight / shRlh) * jStepSize;
                jOdMie += exp(-jHeight / shMie) * jStepSize;

                // Increment the secondary ray time.
                jTime += jStepSize;
            }

            // Calculate attenuation.
            vec3 attn = exp(-(kRlh * (iOdRlh + jOdRlh) + kMie * (iOdMie + jOdMie)));

            // Accumulate scattering.
            totalRlh += odStepRlh * attn * 1.0;
            totalMie += odStepMie * attn * 1.0;

            // Increment the primary ray time.
            iTime += iStepSize;
        }

        // Calculate and return the final color.
        return iSun * (pRlh * kRlh * totalRlh + pMie * kMie * totalMie);
    }`;

LGraphAtmos.VS_CODE = `
    precision mediump float;
	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_coord;

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	uniform mat4 u_mvp;
	uniform mat4 u_model;
	uniform mat4 u_normal_model;
	uniform mat4 u_view;

	void main() {

		vec4 vertex4 = vec4(a_vertex,1.0);
		vec4 normal4 = vec4(a_normal,0.0);
		v_wNormal = a_normal;
		v_coord = a_coord;

		//vertex
		v_wPosition = (u_model * vertex4).xyz;
		//normal
		v_wNormal = (u_model * normal4).xyz;
		gl_Position = u_mvp * vec4(a_vertex,1.0);
}`;

LGraphAtmos.FS_CODE = `

    #extension GL_EXT_draw_buffers : require
    precision highp float;
    varying vec3 v_wPosition;
    varying vec3 v_wNormal;
    uniform vec4 u_color;
    uniform vec4 u_background_color;
    uniform vec3 u_camera_position;
    uniform float u_time;

    uniform float u_rotation;
    uniform float u_speed;
    uniform vec3 u_SunPos; // should be vec3
    uniform vec3 u_RayOrigin;
    uniform float u_SunIntensity;
    uniform vec3 u_RayleighCoeff;
    uniform float u_RayleighScaleHeight;
    uniform float u_MieCoeff;
    uniform float u_MieScaleHeight;
    uniform float u_MieDirection;
    uniform float u_originOffset;

    ` + LGraphAtmos.ATMOS_CODE + `

    mat4 rotationMatrix(vec3 a, float angle) {

        vec3 axis = normalize(a);
        float s = sin(angle);
        float c = cos(angle);
        float oc = 1.0 - c;
        
        return mat4(oc*axis.x*axis.x+c,oc*axis.x*axis.y-axis.z*s,oc*axis.z*axis.x+axis.y*s,0.0,
                    oc*axis.x*axis.y+axis.z*s,oc*axis.y*axis.y+c,oc*axis.y*axis.z-axis.x*s,0.0,
                    oc*axis.z*axis.x-axis.y*s,oc*axis.y*axis.z+axis.x*s,oc*axis.z*axis.z+c,0.0,
                    0.0,0.0,0.0,1.0);
    }

    void main() {
        
        // View direction
        vec3 E = normalize(v_wPosition - u_camera_position);

        if(u_rotation != 0.0)
        E = (rotationMatrix(vec3(0.0,1.0,0.0),u_rotation) * vec4(E,1.0)).xyz;

        // In meters
        float EarthRadius = 6360e3;
        float AtmosphereRadius = 6420e3;

        // RayLeigh Scattering coefficient 
        vec3 RayLeighScatteringCoeffient = vec3(5.5e-6, 13.0e-6, 22.4e-6);
        // Scale height
        float HR = 8e3;

        // Mie coefficients 
        float MieScatteringCoeffient = u_MieCoeff * 1e-6;
        float MieExtinctionCoeffient = 1.1 * 210e-5;
        // Scale height
        float HM = 1.2e3;

        // Anisotropy of the medium
        float g = max(0.01, min(0.975, u_MieDirection));

        // Ray origin
        vec3 RayOrigin = vec3(0.0, 6372e3 + u_originOffset , 0.0);

        // Sun direction
        vec3 SunPos = u_SunPos;

        vec3 color = getSkyColor(
            E,                               // normalized ray direction
            RayOrigin,                       // ray origin
            SunPos,                          // position of the sun
            u_SunIntensity,                   // intensity of the sun
            6371e3,                          // radius of the planet in meters
            6471e3,                          // radius of the atmosphere in meters
            RayLeighScatteringCoeffient,     // Rayleigh scattering coefficient
            MieScatteringCoeffient,          // Mie scattering coefficient
            HR,                              // Rayleigh scale height
            HM,                              // Mie scale height
            g                                // Mie preferred scattering direction
        );

        // Remove gamma
        color = pow( color, vec3(2.2) );
        //gl_FragColor = vec4(color, 1.0);
        gl_FragData[0] = vec4(color, 1.0);
    }`;

LiteGraph.registerNodeType("skybox/atmos", LGraphAtmos);