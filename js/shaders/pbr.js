/*
*   Alex Rodríguez
*   @jxarco 
*/

function PBR_Shader()
{
    if(this.constructor !== PBR_Shader)
        throw("Use new");

    this.defines = {
		GAMMA: 2.2,
		PI: 3.14159265359,
		RECIPROCAL_PI: 0.3183098861837697,

		MAX_REFLECTANCE: 0.16,
		MIN_REFLECTANCE: 0.04,

		MIN_ROUGHNESS: 0.01
	};

    this.uniforms = {};
}   

Object.assign( PBR_Shader.prototype, {
   
    info() {
        console.log("%cSHADER: " + this.constructor.name, 'font-weight: bold');
		console.log("Defines", this.defines);
        console.log("Uniforms", this.uniforms);
    },

	setup() {

		this.vs_code = '\tprecision highp float;\n';
		this.fs_code = [
			'\t#extension GL_OES_standard_derivatives : enable',	
			'\tprecision highp float;\n'
		].join('\n');
		
		for(var i in this.defines) {
			this.vs_code += '\t#define ' + i + " " + this.defines[i] + "\n";
			this.fs_code += '\t#define ' + i + " " + this.defines[i] + "\n";
		}
		
		this.vs_code += this.constructor.VS_CODE;
		this.fs_code += this.constructor.FS_CODE;
	}
} );

PBR_Shader.VS_CODE = `
    attribute vec3 a_vertex;
    attribute vec3 a_normal;
    attribute vec2 a_coord;
    
    varying vec3 v_wPosition;
    varying vec3 v_wNormal;
    varying vec2 v_coord;

    uniform bool u_hasBump;
    uniform float u_bumpScale;
    uniform sampler2D u_height_texture;
    uniform mat4 u_mvp;
    uniform mat4 u_model;

    void main() {

        v_wPosition = (u_model * vec4(a_vertex, 1.0)).xyz;
        v_wNormal = (u_model * vec4(a_normal, 0.0)).xyz;
        v_coord = a_coord;

        vec3 position = a_vertex;

        if(u_hasBump) {
            vec4 bumpData = texture2D( u_height_texture, v_coord );
            float vAmount = bumpData.r;
            position += (v_wNormal * vAmount * u_bumpScale);
        }

        gl_Position = u_mvp * vec4(position, 1.0);
    }

`;

PBR_Shader.FS_CODE = `
    varying vec3 v_wPosition;
    varying vec3 v_wNormal;
    varying vec2 v_coord;
 
    uniform float u_rotation;
    uniform float u_light_intensity;
    uniform vec3 u_light_color;
    uniform vec3 u_light_position;
    uniform vec3 u_camera_position;
    uniform vec4 background_color;

    uniform sampler2D u_brdf_texture;
    uniform samplerCube u_env_texture;
    uniform samplerCube u_env_1_texture;
    uniform samplerCube u_env_2_texture;
    uniform samplerCube u_env_3_texture;
    uniform samplerCube u_env_4_texture;
    uniform samplerCube u_env_5_texture;

    uniform sampler2D u_albedo_texture;
    uniform sampler2D u_normal_texture;
    uniform sampler2D u_roughness_texture;
    uniform sampler2D u_metalness_texture;
    uniform sampler2D u_opacity_texture;
    uniform sampler2D u_emissive_texture;
    uniform sampler2D u_ao_texture;

    uniform vec3 u_albedo;
    uniform float u_roughness;
    uniform float u_metalness;

    uniform float u_ibl_intensity;
    uniform float u_emissiveScale;
    uniform bool u_isEmissive;
    uniform bool u_hasAlpha;	
    uniform bool u_hasNormal;
    uniform bool u_hasAO;
    uniform bool u_enable_ao;
    uniform bool u_correctAlbedo;

	uniform float u_clearCoat;
	uniform float u_clearCoatRoughness;

    struct PBRMat
    {
        float linearRoughness;
        float metallic;
        float f90;
        vec3 f0;
        vec3 diffuseColor;
        vec3 reflection;
        float NoV;
        float NoL;
        float NoH;
        float LoH;
    };

    // Normal Distribution Function (NDC) using GGX Distribution
    float D_GGX (const in float NoH, const in float linearRoughness ) {
        float a2 = linearRoughness * linearRoughness;
        float f = (NoH * a2 - NoH) * NoH + 1.0;
        return a2 / (PI * f * f);
    }

    // Geometric shadowing using Smith Geometric Shadowing function
    // Extracting visibility function V(v, l, a)
    float V_SmithGGXCorrelated (const in float NoV, const in float NoL, const in float linearRoughness ) {
        float a2 = linearRoughness * linearRoughness;
        float GGXL = NoV * sqrt((-NoL * a2 + NoL) * NoL + a2);
        float GGXV = NoL * sqrt((-NoV * a2 + NoV) * NoL + a2);
        return 0.5 / (GGXV + GGXL);
    }

    // Approximation (Not correct 100% but has better performance)
    float V_SmithGGXCorrelatedFast (const in float NoV, const in float NoL, const in float linearRoughness ) {
        float a = linearRoughness;
        float GGXV = NoL * (NoV * (1.0 - a) + a);
        float GGXL = NoV * (NoL * (1.0 - a) + a);
        return 0.5 / (GGXV + GGXL);
    }

    // Visibility term (Kelemen) for Clear coat
    float V_Kelemen (const in float LoH ) {
        return 0.25 / (LoH * LoH);
    }

    // Fresnel effect: Specular F using Schlick approximation
    // f0 is the specular reflectance at normal incident angle
    float F_Schlick (const in float VoH, const in float f0, const in float f90) {
        return f0 + (f90 - f0) * pow(1.0 - VoH, 5.0);
    }

    // Fresnel term with scalar optimization(f90=1)
    vec3 F_Schlick (const in float VoH, const in vec3 f0) {
        float f = pow(1.0 - VoH, 5.0);
        return f0 + (vec3(1.0) - f0) * f;
    }

	float F_Schlick (const in float VoH, const in float f0) {
        return f0 + (1.0 - f0) * pow(1.0 - VoH, 5.0);
    }

    // Diffuse Reflections: Lambertian BRDF
    float Fd_Lambert() {
        return RECIPROCAL_PI;
    }

    // Diffuse Reflections: Disney BRDF using retro-reflections using F term
    float Fd_Burley (const in float NoV, const in float NoL, const in float LoH, const in float linearRoughness) {
        float f90 = 0.5 + 2.0 * linearRoughness * LoH * LoH;
        float lightScatter = F_Schlick(NoL, 1.0, f90);
        float viewScatter  = F_Schlick(NoV, 1.0, f90);
        return lightScatter * viewScatter * RECIPROCAL_PI;
    }

    void updateMaterial (inout PBRMat material) {
        float metallic = u_metalness;
        #ifdef HAS_METALNESS_MAP
            metallic = texture2D(u_metalness_texture, v_coord).r;
        #endif
        
        vec3 baseColor = u_albedo;
        #ifdef HAS_ALBEDO_MAP
            baseColor = texture2D(u_albedo_texture, v_coord).rgb;
        #endif

        // Transform Base Color to linear space
        if( u_correctAlbedo )
            baseColor = pow(baseColor, vec3(GAMMA));

        // Parameter Remapping (Base color)
        vec3 diffuseColor = (1.0 - metallic) * baseColor;

        // Parameter Remapping (f0)
        /* 
            Min reflectance - Water (2%) - Linear value is 0.35
            Default reflectance (4%) - Linear value is 0.5
            Max reflectance - Gemstones (16%) - Linear value is 1.0
        */
        
        float reflectance = 0.5; // default material
        float f90 = 1.0;
        
        // Compute f0 for dielectrics and metallic materials
        vec3 f0 = MAX_REFLECTANCE * reflectance * reflectance * (1.0 - metallic) + baseColor * metallic;

        // Parameter Remapping (roughness)
        float roughness = u_roughness;
        #ifdef HAS_ROUGHNESS_MAP
            roughness = texture2D(u_roughness_texture, v_coord).r;
        #endif
		roughness = max(roughness, MIN_ROUGHNESS);	
        float linearRoughness = roughness * roughness;

        material.metallic = metallic;
        material.linearRoughness = linearRoughness;
        material.f0 = f0;
        material.diffuseColor = diffuseColor;
    }

    void updateVectors (inout PBRMat material) {
        vec3 v = normalize(v_wPosition - u_camera_position);
        vec3 n = normalize( v_wNormal );

        #ifdef HAS_NORMAL_MAP
            vec3 normal_map = texture2D(u_normal_texture, v_coord).xyz;
            n = normalize( perturbNormal( v_wNormal, v, v_coord, normal_map ) );
        #endif

        vec3 l = -normalize(u_light_position - v_wPosition);
        vec3 h = normalize(v + l);

        material.reflection = normalize(reflect(-v, n));
        material.NoV = abs(dot(-n, v)) + 1e-5;
        material.NoL = clamp(dot(-n, l), 0.0, 1.0);
        material.NoH = clamp(dot(-n, h), 0.0, 1.0);
        material.LoH = clamp(dot(l, h), 0.0, 1.0);
    }

    vec3 specularBRDF( const in PBRMat material ) {
        float D = D_GGX( material.NoH, material.linearRoughness );
        float V = V_SmithGGXCorrelated( material.NoV, material.NoL, material.linearRoughness );
        vec3 F = F_Schlick( material.LoH, material.f0 );
        return (D * V) * F;
    }

	float specularClearCoat( const PBRMat material, float clearCoat, float clearCoatLinearRoughness ) {
		
		float D = D_GGX( clearCoatLinearRoughness, material.NoH );
		float V = V_Kelemen( material.LoH );
		float F = F_Schlick( material.LoH, 0.04 ) * clearCoat;
		return (D * V) * F;
	}

	// still no energy compensation
	vec3 do_lighting(const in PBRMat material)
	{
		// Specular BRDF
        vec3 Fr = specularBRDF( material );
        // Diffuse BRDF
        vec3 Fd = material.diffuseColor * Fd_Lambert();
		// Combine
		vec3 color = Fd + Fr;

		if(true) {
			
			float clearCoat = u_clearCoat; // clear coat strengh
			float clearCoatRoughness = u_clearCoatRoughness;
			
			// Parameter remapping (clearCoatRoughness)
			clearCoatRoughness = mix(0.089, 0.6, clearCoatRoughness);
			float clearCoatLinearRoughness = clearCoatRoughness * clearCoatRoughness;

			// Specular BRDF (Clear coat lobe only represents specular BRDF)
			float Fcc = specularClearCoat( material, clearCoat, clearCoatRoughness );
			float attenuation = 1.0 - Fcc;

			color = (Fd + Fr /* * (energyCompensation * attenuation)*/) * attenuation + clearCoat;
		}

		vec3 lightScale = vec3(u_light_intensity);
		vec3 finalColor = color * material.NoL * u_light_color * lightScale;
    	return finalColor;
	}

    void main() {
        
        PBRMat material = PBRMat(
            0.0, 0.0, 0.0,
            vec3(0.0), vec3(0.0), vec3(0.0),
            0.0, 0.0, 0.0, 0.0
		);

        updateMaterial( material );
        updateVectors( material );

		vec3 color = do_lighting( material );
        
        // Energy loss
        gl_FragColor = vec4(color, 1.0);
    }

`;

RM.registerShader( PBR_Shader, "PBR" );