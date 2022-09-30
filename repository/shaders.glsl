\shaders

// Basic shaders
flat default.vs default.fs
textured default.vs textured.fs
textured_phong default.vs textured_phong.fs
basicFx screen_shader.vs basicFx.fs

// Cubemap shaders
skybox default.vs skybox.fs
sphereMap default.vs sphereMap.fs
mirror default.vs mirroredSphere.fs

\default.vs

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
	}

//
// Default fragment shader 
//

\default.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;

	void main() {

		gl_FragColor = u_color;
	}

\basicFx.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;

	uniform sampler2D u_face_texture;

	vec3 uncharted2Tonemap(const vec3 x) {
		const float A = 0.15;
		const float B = 0.50;
		const float C = 0.10;
		const float D = 0.20;
		const float E = 0.02;
		const float F = 0.30;
		return ((x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F)) - E / F;
	}

	// http://filmicworlds.com/blog/filmic-tonemapping-operators/
	vec3 tonemapUncharted2(const vec3 color) {
		const float W = 11.2;
		const float exposureBias = 2.0;
		vec3 curr = uncharted2Tonemap(exposureBias * color);
		vec3 whiteScale = 1.0 / uncharted2Tonemap(vec3(W));
		return curr * whiteScale;
	}


	void main() {

		vec4 color = texture2D(u_face_texture, v_coord);

		color.rgb = tonemapUncharted2(color.rgb);
		color.rgb = pow(color.rgb, vec3(1./2.2));

		gl_FragColor = color;
	}

\textured.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	
	uniform vec4 u_color;
	uniform sampler2D u_albedo_texture;

	void main() {

		gl_FragColor = u_color * texture2D(u_albedo_texture, v_coord);
	}

\textured_phong.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	
	uniform vec3 u_camera_position;
	uniform vec3 u_lightcolor;
	uniform vec3 u_lightvector;
	uniform vec4 u_color;
	
	uniform float u_specular_power;
	uniform float u_specular_gloss;
	uniform float u_reflectivity;
	uniform vec3 u_ambient;

	uniform sampler2D u_albedo_texture;
	uniform samplerCube u_SpecularEnvSampler_texture;

	void applyReflection(vec3 R, inout vec4 color)
	{
		vec3 bg = textureCube(u_SpecularEnvSampler_texture, R).rgb;
		color.xyz = mix( color.xyz, bg, clamp( u_reflectivity, 0.0, 1.0) );
	}

	void main() {
		
		vec3 N = normalize(v_wNormal);
		vec3 ambient = u_ambient;

		// vec3 L = u_lightvector; 
		vec3 L_pos = vec3(3., 3., 0.);
		vec3 L = normalize(L_pos - v_wPosition);

		// vec3 Lcolor = u_lightcolor; 
		vec3 Lcolor = vec3(1.0);

		vec3 V = normalize(u_camera_position - v_wPosition);
		vec3 R_view = reflect(V, N);  
		vec3 R = reflect(-L, N);  

		float NdotL = max(0.0, dot(L,N));
		float Gloss = max(u_specular_gloss, 1.0);

		vec3 Diffuse = vec3(abs(NdotL));
		vec3 Specular = vec3(u_specular_power * pow( clamp(dot(R,V),0.001,1.0), Gloss ));

		vec4 material_color = u_color * texture2D(u_albedo_texture, v_coord);
		vec4 color = material_color * vec4(ambient + Diffuse + Specular, 1.0);

		if(u_reflectivity > 0.0)
			applyReflection(R_view, color);

		gl_FragColor = vec4(color.rgb, 1.0);
	}

\flipY.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;

	uniform sampler2D u_color_texture;

	void main() {

		vec2 coord = vec2( v_coord.x, 1.0 - v_coord.y );
		gl_FragColor = texture2D(u_color_texture, coord);
	}

\screen_shader.vs

	precision highp float;
	attribute vec3 a_vertex;
	attribute vec2 a_coord;
	varying vec2 v_coord;

	void main() {
		v_coord = a_coord;
		gl_Position = vec4(a_coord * 2.0 - 1.0, 0.0, 1.0);
	}

\mirroredSphere.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	uniform vec4 u_color;
	uniform vec3 u_camera_position;

	uniform bool u_flipX;
	uniform bool u_gamma;
	uniform bool u_tonemap;
	uniform float u_exposure;
	
	uniform samplerCube u_color_texture;

	void main() {

		vec3 E = normalize(u_camera_position - v_wPosition);

		vec3 R = reflect(E, normalize(v_wNormal));

		if(u_flipX)
			R.x = -R.x;

		vec4 color = textureCube(u_color_texture, R) * u_exposure;
		
		if(u_tonemap)
			color = color / (color + vec4(1.0));
		if(u_gamma)
			color = pow(color, vec4(1.0/2.2));

		gl_FragColor = color;
	}

//
// Shader used to show skybox 
//

\skybox.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform float u_rotation;
	uniform vec3 u_camera_position;
	
	uniform samplerCube u_color_texture;
	uniform bool u_flipX;
	uniform bool u_gamma;
	uniform bool u_tonemap;
	uniform float u_exposure;
	

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

		vec3 E = normalize(u_camera_position - v_wPosition);
		
		if(u_flipX)
			E.x = -E.x;
		
		E = (rotationMatrix(vec3(0.0,1.0,0.0),u_rotation) * vec4(E,1.0)).xyz;

		vec4 color = textureCube(u_color_texture, E) * u_exposure;

		if(u_gamma)
			color = pow(color, vec4(1.0/2.2));

		if(u_tonemap)
			color = color / (color + vec4(1.0));
		

		gl_FragColor = color;
	}

//
// Shader used to show skybox from sphere map (+ Exposure)
//

\sphereMap.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform sampler2D u_color_texture;
	uniform float u_fov;

	//u_fov = arctan(r/d);

	void main() {
	    vec3 E = normalize(v_wPosition - u_camera_position);

	    float d = sqrt(E.x * E.x + E.y * E.y);
		float r = 0.0;

		if(d > 0.0)
			r = 0.159154943 * acos(E.z) / d;

	    float u = 0.5 + E.x * r;
		float v = 0.5 + E.y * r;

	    vec2 spherical_uv = vec2(u, v);
	    vec4 color = texture2D(u_color_texture, spherical_uv);

	    gl_FragColor = color;
	}

