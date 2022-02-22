// PBRLite 
// @jxarco

/*
	Example use case for pbr lighting
	It uses only indirect illumination from 
	HDRE cubemap. 
*/

var PBR = {

    brdf_tex: null,

    // Load textures: environment mips and brdf texture
    init()
    {
        if(!LS || !GL)
        throw("Add Litescene.js and litegl.js to your project");

		if(!HDRE)
        throw("Add hdre.js to your project");

        this.brdf_tex = this.createBRDF();
		this.shader = new GL.Shader(this.VERTEX_SHADER, this.FRAGMENT_SHADER);
		gl.shaders["pbr"] = this.shader;
    },

    getUniforms()
    {
        return {
            "u_albedo": vec3.fromValues(1, 1, 1),
            "u_roughness": 1.0,
            "u_metalness": 1.0,
            "u_alpha": 1.0,
            "u_Skinning": false, // mesh skinning 
        }
    },

    setTextures(node, filename)
    {
        if(!node)
        throw("no node");

        // update environment map textures
        var mipCount = 5;
        
        // LS or RD node
        var node_textures = node.material ? node.material.textures : node.textures;

		// All textures are stored in original tex mipmaps
		node_textures['brdf'] = "_brdf_integrator";
		node_textures['SpecularEnvSampler'] =  filename;
    },

    setTextureProperties(node)
    {
        if(!node)
        throw("no node");

        /*
        Encode properties in two vec4
        vec4 properties_array0
        vec4 properties_array1
        */

        var properties = {};

        // LS or RD node
        var node_textures = node.material ? node.material.textures : node.textures;

        var isEmissive = node_textures['emissive'] ? 1 : 0; 
        var hasAlpha = node_textures['opacity'] ? 1 : 0;
        var hasAO = node_textures['ao'] ? 1 : 0; 
        var hasBump = node_textures['height'] ? 1 : 0; 

        var hasAlbedo = node_textures['albedo'] ? 1 : 0; 
        var hasRoughness = node_textures['roughness'] ? 1 : 0; 
        var hasMetalness = node_textures['metalness'] ? 1 : 0; 
        var hasNormal = node_textures['normal'] ? 1 : 0; 

        properties["u_properties_array0"] = vec4.fromValues(
                hasAlbedo,
                hasRoughness,
                hasMetalness,
                hasNormal
        );

        properties["u_properties_array1"] = vec4.fromValues(
                isEmissive,
                hasAlpha,
                hasAO,
                hasBump
        );

        if(node.material)
        {
            // LS SceneNode
            for(var i in properties)
            node.material._uniforms[i] = properties[i];
        }else
        {
            // Rendeer SceneNode
            for(var i in properties)
            node._uniforms[i] = properties[i];
        }
    },

    setHDRE( file, on_complete )
    {
        if(!LiteGUI)
        throw("Add LiteGUI to the project!");

        var that = this;

        LiteGUI.request({dataType: "arraybuffer", url: file, success: function(result){

            var tokens = file.split("/");
			var filename = tokens[tokens.length-1];

            that.parseHDRE(result, filename);

            if(on_complete)
                on_complete(filename);
		}});
    },

    createBRDF()
    {
        var tex_name = '_brdf_integrator';
		var options = { type: gl.FLOAT, texture_type: gl.TEXTURE_2D, filter: gl.LINEAR};
		
		var shader = new GL.Shader(PBR.BRDF_VSHADER, PBR.BRDF_FSHADER);
        var tex = gl.textures[tex_name] = new GL.Texture(128, 128, options);

        tex.drawTo(function(texture) {
    
            shader.draw(Mesh.getScreenQuad(), gl.TRIANGLES);
		});
		
		return tex;
    },

    parseHDRE( buffer, tex_name, on_complete)
    {
        var r = HDRE.parse(buffer, {onprogress: onprogress});

		if(!r)
			return false;

        var _envs = r._envs;
        var header = r.header;
        var textures = [];

        var version = header.version;
        this.printVersion( version );

        // Get base enviroment texture

        var type = GL.FLOAT;
		var data = _envs[0].data;
		
        var options = {
            format: header.nChannels == 4 ? gl.RGBA : gl.RGB,
            type: type,
            minFilter: gl.LINEAR_MIPMAP_LINEAR,
            texture_type: GL.TEXTURE_CUBE_MAP,
            pixel_data: data
        };

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false );
        let tex = new GL.Texture( _envs[0].width, _envs[0].width, options);
        tex.mipmap_data = {};
        
        // Generate mipmap
        tex.bind(0);
        gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
        tex.unbind();

        // Upload prefilter mipmaps
        for(var i = 1; i < 6; i++){

            var pixels =  _envs[i].data;
            
            for(var f = 0; f < 6; ++f)
                tex.uploadData( pixels[f], { no_flip: true, cubemap_face: f, mipmap_level: i}, true );

            tex.mipmap_data[i] = pixels;
        }
        
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true );

        // Store the texture 
        gl.textures[tex_name] = tex;
        tex.has_mipmaps = true;
        tex.data = null;

		return true;
    },

    printVersion( v )
    {
        console.log( '%cHDRE v'+v, 'padding: 3px; background: rgba(0, 0, 0, 0.75); color: #6E6; font-weight: bold;' );
    },

    downloadTexture(name)
    {
        var tex = name.constructor === GL.Texture ? name : gl.textures[name];
        if(!tex) {
            console.error("no texture named " + name);
            return;
        }
        var canvas = tex.toCanvas();
        var a = document.createElement("a");
        a.download = name + ".png";
        a.href = canvas.toDataURL();
        a.title = "Texture image";
        a.appendChild(canvas);
        var new_window = window.open();
        new_window.document.title.innerHTML = "Texture image";
        new_window.document.body.appendChild(a);
        new_window.focus();
    }
}

PBR.VERTEX_SHADER = `
    precision highp float;
	attribute vec3 a_vertex;
	attribute vec3 a_normal;
	attribute vec2 a_coord;
	attribute vec4 a_bone_indices;
	attribute vec4 a_weights;

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	uniform vec4 u_properties_array0;
	uniform vec4 u_properties_array1;
	uniform mat4 u_bones[64];
	uniform bool u_Skinning;

	uniform mat4 u_mvp;
	uniform mat4 u_viewprojection;
	uniform mat4 u_model;

	void computeSkinning(inout vec3 vertex, inout vec3 normal)
	{
		vec4 v = vec4(vertex,1.0);
		vertex = (u_bones[int(a_bone_indices.x)] * a_weights.x * v + 
				u_bones[int(a_bone_indices.y)] * a_weights.y * v + 
				u_bones[int(a_bone_indices.z)] * a_weights.z * v + 
				u_bones[int(a_bone_indices.w)] * a_weights.w * v).xyz;
		vec4 N = vec4(normal,0.0);
		normal =	(u_bones[int(a_bone_indices.x)] * a_weights.x * N + 
				u_bones[int(a_bone_indices.y)] * a_weights.y * N + 
				u_bones[int(a_bone_indices.z)] * a_weights.z * N + 
				u_bones[int(a_bone_indices.w)] * a_weights.w * N).xyz;
		normal = normalize(normal);
	}

	void main() {

		vec3 vertex = a_vertex;
		vec3 normal = a_normal;

		if(u_Skinning)
			computeSkinning(vertex,normal);

		v_wPosition = (u_model * vec4(vertex, 1.0)).xyz;
		v_wNormal = (u_model * vec4(normal, 0.0)).xyz;
		v_coord = a_coord;

		vec3 position = vertex;
		mat4 transform_matrix = u_viewprojection;

		gl_Position = transform_matrix * vec4(v_wPosition, 1.0);
    }
`;
    
PBR.FRAGMENT_SHADER = `
	
	#extension GL_OES_standard_derivatives : enable
	#extension GL_EXT_shader_texture_lod : enable
	precision highp float;

	#define GAMMA 2.2
	#define PI 3.14159265359
	#define RECIPROCAL_PI 0.3183098861837697
	#define MAX_REFLECTANCE 0.16
	#define MIN_REFLECTANCE 0.04
	#define MIN_PERCEPTUAL_ROUGHNESS 0.045
	#define MIN_ROUGHNESS            0.002025
	#define MAX_CLEAR_COAT_PERCEPTUAL_ROUGHNESS 0.6

	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	uniform float u_rotation;
	uniform float u_light_intensity;
	uniform vec3 u_light_color;
	uniform vec3 u_light_position;
	uniform vec3 u_camera_position;
	uniform vec3 u_background_color;
	uniform vec4 u_viewport;
	uniform bool u_applyGamma;

	uniform sampler2D u_brdf_texture;

	// Environment textures
	uniform samplerCube u_SpecularEnvSampler_texture;

	// Mat textures
	uniform sampler2D u_albedo_texture;
	uniform sampler2D u_normal_texture;
	uniform sampler2D u_roughness_texture;
	uniform sampler2D u_metalness_texture;
	uniform sampler2D u_opacity_texture;
	uniform sampler2D u_height_texture;
	uniform sampler2D u_emissive_texture;
	uniform sampler2D u_ao_texture;

	// Mat properties
	uniform vec4 u_color;
	uniform float u_roughness;
	uniform float u_metalness;
	uniform float u_alpha;

	uniform vec4 u_properties_array0;
	uniform vec4 u_properties_array1;
	uniform bool u_selected;

	struct PBRMat
	{
		float linearRoughness;
		float roughness;
		float metallic;
		float alpha;
		float f90;
		vec3 f0;
		vec3 reflectance;
		vec3 baseColor;
		vec3 diffuseColor;
		vec3 specularColor;
		vec3 reflection;
		vec3 N;
		vec3 V;
		vec3 H;
		float NoV;
		float NoL;
		float NoH;
		float LoH;
		float VoH;
		float clearCoat;
		float clearCoatRoughness;
		float clearCoatLinearRoughness;
	};

	//Javi Agenjo Snipet for Bump Mapping
	mat3 cotangent_frame(vec3 N, vec3 p, vec2 uv){
		// get edge vectors of the pixel triangle
		vec3 dp1 = dFdx( p );
		vec3 dp2 = dFdy( p );
		vec2 duv1 = dFdx( uv );
		vec2 duv2 = dFdy( uv );

		// solve the linear system
		vec3 dp2perp = cross( dp2, N );
		vec3 dp1perp = cross( N, dp1 );
		vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
		vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;

		// construct a scale-invariant frame
		float invmax = inversesqrt( max( dot(T,T), dot(B,B) ) );
		return mat3( T * invmax, B * invmax, N );
	}

	vec3 perturbNormal( vec3 N, vec3 V, vec2 texcoord, vec3 normal_pixel ){
		#ifdef USE_POINTS
		return N;
		#endif

		// assume N, the interpolated vertex normal and
		// V, the view vector (vertex to eye)
		//vec3 normal_pixel = texture2D(normalmap, texcoord ).xyz;
		normal_pixel = normal_pixel * 255./127. - 128./127.;
		mat3 TBN = cotangent_frame(N, V, texcoord);
		return normalize(TBN * normal_pixel);
	}

	#define MEDIUMP_FLT_MAX    65504.0
	#define saturateMediump(x) min(x, MEDIUMP_FLT_MAX)

	float D_GGX_2(float linearRoughness, float NoH, const vec3 n, const vec3 h) {
	    vec3 NxH = cross(n, h);
	    float a = NoH * linearRoughness;
	    float k = linearRoughness / (dot(NxH, NxH) + a * a);
	    float d = k * k * (1.0 / PI);
	    return saturateMediump(d);
	}

	// Normal Distribution Function (NDC) using GGX Distribution
	float D_GGX (const in float NoH, const in float linearRoughness ) {
		
		float a2 = linearRoughness * linearRoughness;
		float f = (NoH * NoH) * (a2 - 1.0) + 1.0;
		return a2 / (PI * f * f);
		
	}

	// Geometry Term : Geometry masking / shadowing due to microfacets
	float GGX(float NdotV, float k){
		return NdotV / (NdotV * (1.0 - k) + k);
	}
	
	float G_Smith(float NdotV, float NdotL, float roughness){
		
		float k = pow(roughness + 1.0, 2.0) / 8.0;
		return GGX(NdotL, k) * GGX(NdotV, k);
	}

	// Geometric shadowing using Smith Geometric Shadowing function
	// Extracting visibility function V(v, l, a)
	float V_SmithGGXCorrelated(float NoV, float NoL, float linearRoughness) {
	    float a2 = linearRoughness * linearRoughness;
	    float GGXV = NoL * sqrt(NoV * NoV * (1.0 - a2) + a2);
	    float GGXL = NoV * sqrt(NoL * NoL * (1.0 - a2) + a2);
	    return 0.5 / (GGXV + GGXL);
	}

	// Approximation (Not correct 100% but has better performance)
	float V_SmithGGXCorrelatedFast(float NoV, float NoL, float linearRoughness) {
	    float a = linearRoughness;
	    float GGXV = NoL * (NoV * (1.0 - a) + a);
	    float GGXL = NoV * (NoL * (1.0 - a) + a);
	    return 0.5 / (GGXV + GGXL);
	}

	float Geometric_Smith_Schlick_GGX_(float a, float NdV, float NdL) {
	    // Smith schlick-GGX.
	    float k = a * 0.5;
	    float GV = NdV / (NdV * (1.0 - k) + k);
	    float GL = NdL / (NdL * (1.0 - k) + k);
	    return GV * GL;
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

	float sq(float x) {
	    return x * x;
	}

	float max3(const vec3 v) {
	    return max(v.x, max(v.y, v.z));
	}

	float iorToF0 (float transmittedIor, float incidentIor) {
	    return sq((transmittedIor - incidentIor) / (transmittedIor + incidentIor));
	}

	float f0ToIor(float f0) {
	    float r = sqrt(f0);
	    return (1.0 + r) / (1.0 - r);
	}

	vec3 computeDielectricF0(vec3 reflectance) {
	    return MAX_REFLECTANCE * reflectance * reflectance;
	}

	vec3 f0ClearCoatToSurface(const vec3 f0, float ior) {


		return vec3( clamp(iorToF0(  f0ToIor(f0.x), ior ), 0.0, 1.0) );
	

		// Approximation of iorTof0(f0ToIor(f0), 1.5)
		// This assumes that the clear coat layer has an IOR of 1.5
		//return clamp(f0 * (f0 * (0.941892 - 0.263008 * f0) + 0.346479) - 0.0285998, 0.0, 1.0);
	}

	void updateVectors (inout PBRMat material) {

		vec3 v = normalize(u_camera_position - v_wPosition);
		vec3 n = normalize( v_wNormal );

		if(u_properties_array0.w != 0.){
			vec3 normal_map = texture2D(u_normal_texture, v_coord).xyz;
			n = normalize( perturbNormal( n, -v, v_coord, normal_map ) );			
		}

		vec3 l = normalize(u_light_position - v_wPosition);
		vec3 h = normalize(v + l);

		material.reflection = normalize(reflect(v, n));

		material.N = n;
		material.V = v;
		material.H = h;
		material.NoV = clamp(dot(n, v), 0.0, 0.99) + 1e-6;
		material.NoL = clamp(dot(n, l), 0.0, 1.0) + 1e-6;
		material.NoH = clamp(dot(n, h), 0.0, 1.0) + 1e-6;
		material.LoH = clamp(dot(l, h), 0.0, 1.0) + 1e-6;
		material.VoH = clamp(dot(v, h), 0.0, 1.0) + 1e-6;
	}

	vec3 computeDiffuseColor(vec3 baseColor, float metallic) {
	
		return (1.0 - metallic) * baseColor;
	}

	vec3 computeF0(const vec3 baseColor, float metallic, vec3 reflectance) {
	    return baseColor * metallic + (reflectance * (1.0 - metallic));
	}

	float rand(vec2 co)  {
		return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
	}

	void createMaterial (inout PBRMat material) {

		float metallic = max(0.01, u_metalness);
		
		if(u_properties_array0.z != 0.)
			metallic *= texture2D(u_metalness_texture, v_coord).r;

		vec3 baseColor = u_color.rgb;

		if(u_properties_array0.x != 0.){
			vec3 albedo_tex = texture2D(u_albedo_texture, v_coord).rgb;
			baseColor *= albedo_tex;
		}

		if(u_selected)
			baseColor = vec3(1.0);

		// GET COMMON MATERIAL PARAMS
		vec3 reflectance = computeDielectricF0( vec3(0.5) );
		vec3 diffuseColor = computeDiffuseColor(baseColor, metallic);
		vec3 f0 = computeF0(baseColor, metallic, reflectance);

		// GET ROUGHNESS PARAMS
		float roughness = 1.0;
		if(u_properties_array0.y != 0.){
				
			vec4 sampler = texture2D(u_roughness_texture, v_coord);
			roughness *= sampler.r;
		}

		roughness *= u_roughness;

		roughness = clamp(roughness, MIN_ROUGHNESS, 1.0);	
		float linearRoughness = roughness * roughness;

		material.roughness = roughness;
		material.linearRoughness = linearRoughness;
		material.metallic = metallic;
		material.f0 = f0;
		material.diffuseColor = diffuseColor;
		material.baseColor = baseColor;
		material.reflectance = reflectance;
		
		updateVectors( material );
	}

	vec3 prem(vec3 R, float roughness) {

		float 	f = roughness * 5.0;
		vec3 	r = R;

		vec4 color;

		if(f < 1.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 0.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 1.0), f );
		else if(f < 2.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 1.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 2.0), f - 1.0 );
		else if(f < 3.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 2.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 3.0), f - 2.0 );
		else if(f < 4.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 3.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 4.0), f - 3.0 );
		else if(f < 5.0) color = mix( textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 4.0), textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 5.0), f - 4.0 );
		else color = textureCubeLodEXT(u_SpecularEnvSampler_texture, r, 5.0);

		return color.rgb;
	}

	void getIBLContribution (PBRMat material, inout vec3 Fd, inout vec3 Fr)
	{
		float NdotV = material.NoV;

		vec2 brdfSamplePoint = vec2(NdotV, material.roughness);
		vec2 brdf = texture2D(u_brdf_texture, brdfSamplePoint).rg;

		vec3 normal = -material.N;

		vec3 diffuseSample = prem(normal, 1.0); // diffuse part uses normal vector (no reflection)
		vec3 specularSample = prem(material.reflection, material.roughness);

		vec3 specularColor = mix(material.f0, material.baseColor.rgb, material.metallic);

		Fd += diffuseSample * material.diffuseColor;
		Fr += specularSample * (specularColor * brdf.x + brdf.y);
	}

	void do_lighting(inout PBRMat material, inout vec3 color)
	{
		// INDIRECT LIGHT: IBL ********************

		vec3 Fd_i = vec3(0.0);
		vec3 Fr_i = vec3(0.0);
		getIBLContribution(material, Fd_i, Fr_i); // no energy conservation
		
		vec3 indirect = Fd_i + Fr_i;

		// Apply ambient oclusion 
		if(u_properties_array1.z != 0.0)
			indirect *= texture2D(u_ao_texture, v_coord).r;
		
	
		color  = indirect;
	}

	void main() {
        
		PBRMat material;
		vec3 color;

		createMaterial( material );
		do_lighting( material, color);

		if(u_properties_array1.x != 0.)
			color += texture2D(u_emissive_texture, v_coord).rgb;
		color /= (color+vec3(1.0));
		gl_FragColor = vec4(color, 1.0);
	}
`;

PBR.BRDF_SAMPLING_SHADERCODE = `

		/* -- Tangent Space conversion -- */
		vec3 tangent_to_world(vec3 vector, vec3 N, vec3 T, vec3 B)
		{
		  return T * vector.x + B * vector.y + N * vector.z;
		}
		vec2 noise2v(vec2 co)  {
		    return vec2(
				fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453),
				fract(sin(dot(co.yx ,vec2(12.9898,78.233))) * 43758.5453)
			);
		}
		float noise(vec2 co)  {
		    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
		}
		vec3 sample_ggx(vec3 rand, float a2)
		{
		  /* Theta is the aperture angle of the cone */
		  float z = sqrt((1.0 - rand.x) / (1.0 + a2 * rand.x - rand.x)); /* cos theta */
		  float r = sqrt(max(0.0, 1.0 - z * z));                        /* sin theta */
		  float x = r * rand.y;
		  float y = r * rand.z;

		  /* Microfacet Normal */
		  return vec3(x, y, z);
		}
		vec3 hammersley_3d(float i, float invsamplenbr)
		{
		  vec3 Xi; /* Theta, cos(Phi), sin(Phi) */

		  Xi.x = i * invsamplenbr; /* i/samples */
		  Xi.x = fract(Xi.x + jitternoise.x);

		  int u = int(mod(i + jitternoise.y * HAMMERSLEY_SIZE, HAMMERSLEY_SIZE));

		  Xi.yz = texture2D(u_hammersley_sample_texture, vec2(u, 0)).rg;

		  return Xi;
		}
		vec2 Hammersley(const in int index, const in int numSamples){
			vec2 r = fract(vec2(float(index) * 5.3983, float(int(int(2147483647.0) - index)) * 5.4427));
			r += dot(r.yx, r.xy + vec2(21.5351, 14.3137));
			return fract(vec2(float(index) / float(numSamples), (r.x * r.y) * 95.4337));
		}
		vec3 sample_ggx(float nsample, float a2, vec3 N, vec3 T, vec3 B)
		{
			vec3 Xi = vec3(
				Hammersley(int(nsample), sampleCount),
				0.0
			);
			// Xi = hammersley_3d(nsample, float(1.0/float(sampleCount)));
			vec3 Ht = sample_ggx(Xi, a2);
			return tangent_to_world(Ht, N, T, B);
		}
		float G1_Smith_GGX(float NX, float a2)
		{
		  /* Using Brian Karis approach and refactoring by NX/NX
		   * this way the (2*NL)*(2*NV) in G = G1(V) * G1(L) gets canceled by the brdf denominator 4*NL*NV
		   * Rcp is done on the whole G later
		   * Note that this is not convenient for the transmission formula */
		  return NX + sqrt(NX * (NX - NX * a2) + a2);
		  /* return 2 / (1 + sqrt(1 + a2 * (1 - NX*NX) / (NX*NX) ) ); /* Reference function */
		}
		
	`;

	PBR.BRDF_VSHADER = `
		
		precision highp float;

		attribute vec3 a_vertex;
		attribute vec3 a_normal;
		attribute vec2 a_coord;

		varying vec2 v_coord;
		varying vec3 v_vertex;

		void main(){
			v_vertex = a_vertex;
			v_coord  = a_coord;
			vec3 pos = v_vertex * 2.0 - vec3(1.0);
			gl_Position = vec4(pos, 1.0);
		}
	`;

	PBR.BRDF_FSHADER = `

		// BLENDER METHOD
		precision highp float;
		varying vec2 v_coord;
		varying vec3 v_vertex;
		vec2 jitternoise = vec2(0.0);

		uniform sampler2D u_hammersley_sample_texture;

		#define sampleCount 8192
		#define PI 3.1415926535897932384626433832795
		
		const float HAMMERSLEY_SIZE = 8192.0; 

		`  +  PBR.BRDF_SAMPLING_SHADERCODE +  `
		
		 void main() {

			vec3 N, T, B, V;

			float NV = ((clamp(v_coord.y, 1e-4, 0.9999)));
			float sqrtRoughness = clamp(v_coord.x, 1e-4, 0.9999);
			float a = sqrtRoughness * sqrtRoughness;
			float a2 = a * a;

			N = vec3(0.0, 0.0, 1.0);
			T = vec3(1.0, 0.0, 0.0);
			B = vec3(0.0, 1.0, 0.0);
			V = vec3(sqrt(1.0 - NV * NV), 0.0, NV);

			// Setup noise (blender version)
			jitternoise = noise2v(v_coord);

			 /* Integrating BRDF */
			float brdf_accum = 0.0;
			float fresnel_accum = 0.0;
			for (int i = 0; i < sampleCount; i++) {
				vec3 H = sample_ggx(float(i), a2, N, T, B); /* Microfacet normal */
				vec3 L = -reflect(V, H);
				float NL = L.z;

				if (NL > 0.0) {
					float NH = max(H.z, 0.0);
					float VH = max(dot(V, H), 0.0);

					float G1_v = G1_Smith_GGX(NV, a2);
					float G1_l = G1_Smith_GGX(NL, a2);
					float G_smith = 4.0 * NV * NL / (G1_v * G1_l); /* See G1_Smith_GGX for explanations. */

					float brdf = (G_smith * VH) / (NH * NV);
					float Fc = pow(1.0 - VH, 5.0);

					brdf_accum += (1.0 - Fc) * brdf;
					fresnel_accum += Fc * brdf;
				}
			}

			brdf_accum /= float(sampleCount);
			fresnel_accum /= float(sampleCount);

			gl_FragColor = vec4(brdf_accum, fresnel_accum, 0.0, 1.0);
		}
	`;