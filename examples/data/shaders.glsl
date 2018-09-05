\shaders

exposure default.vs exposure.fs
skybox default.vs skybox.fs
skyboxExpo default.vs skyboxExpo.fs
sphereMap default.vs sphereMap.fs
copy screen_shader.vs copy.fs

\default.vs

	precision highp float;
    attribute vec3 a_vertex;
	attribute vec3 a_normal;
    attribute vec2 a_coord;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
    varying vec2 v_coord;
    uniform mat4 u_mvp;
    uniform mat4 u_model;
    void main() {
		v_wPosition = (u_model * vec4(a_vertex, 1.0)).xyz;
		v_wNormal = (u_model * vec4(a_normal, 1.0)).xyz;
        v_coord = a_coord;
        gl_Position = u_mvp * vec4(a_vertex,1.0);
        gl_PointSize = 2.0;
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

\exposure.fs

	precision highp float;
    varying vec2 v_coord;
    uniform vec4 u_color;
    uniform float exposure;
    uniform float brightMax;
    uniform sampler2D u_color_texture;
    void main() {
        vec4 color = texture2D(u_color_texture, v_coord);
        float Y = dot(vec4(0.30, 0.59, 0.11, 0.0), color);
        float YD = exposure * (exposure / brightMax + 1.0) / (exposure + 1.0);
        color *= YD;
        gl_FragColor = color;
    }

\skybox.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform samplerCube u_color_texture;
	void main() {
	    vec3 E = v_wPosition - u_camera_position;
	    E = normalize(E);
	    vec4 color = textureCube(u_color_texture, E);
	    gl_FragColor = vec4(color.xyz, 1.0);
	}

\skyboxExpo.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform float exposure;
	uniform float brightMax;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform samplerCube u_color_texture;
	void main() {
	    vec3 E = v_wPosition - u_camera_position;
	    E = normalize(E);
	    vec4 color = textureCube(u_color_texture, E);
	    float Y = dot(vec4(0.30, 0.59, 0.11, 0.0), color);
        float YD = exposure * (exposure / brightMax + 1.0) / (exposure + 1.0);
        color *= YD;
	    gl_FragColor = color;
	}

\sphereMap.fs

	precision highp float;
	varying vec3 v_wPosition;
	varying vec3 v_wNormal;
	varying vec2 v_coord;
	uniform float exposure;
	uniform float brightMax;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform sampler2D u_color_texture;
	void main() {
	    vec3 E = v_wPosition - u_camera_position;
	    E = normalize(E);

	    E.x *= -1.0;
	    E.y *= -1.0;

	    float d = sqrt(E.x * E.x + E.y * E.y);
		float r = 0.0;

		if(d > 0.0)
			r = 0.159154943 * acos(E.z) / d;
		
	    float u = 0.5 + E.x * r;
		float v = 0.5 + E.y * r;

	    vec2 spherical_uv = vec2(u, v);
	    vec4 color = texture2D(u_color_texture, spherical_uv);
	    
	    // apply exposure to sphere map
	    float Y = dot(vec4(0.30, 0.59, 0.11, 0.0), color);
        float YD = exposure * (exposure / brightMax + 1.0) / (exposure + 1.0);
        color *= YD;

	    gl_FragColor = color;
	}

\copy.fs

	precision highp float;
	varying vec2 v_coord;
	uniform float exposure;
	uniform float brightMax;
	uniform vec4 u_color;
	uniform vec4 background_color;
	uniform vec3 u_camera_position;
	uniform sampler2D u_color_texture;
	uniform mat3 u_rotation;

	vec2 getSphericalUVs(vec3 dir) {

		dir = normalize(dir);

	    dir.x *= -1.0;
	    dir.y *= -1.0;

	    float d = sqrt(dir.x * dir.x + dir.y * dir.y);
		float r = 0.0;

		if(d > 0.0)
			r = 0.159154943 * acos(dir.z) / d;
		
	    float u = 0.5 + dir.x * r;
		float v = 0.5 + dir.y * r;

		return vec2(u, v);
	}

	void main() {

		vec2 uv = vec2( v_coord.x, 1.0 - v_coord.y );
		vec3 dir = vec3( uv - vec2(0.5), 0.5 );
		dir = u_rotation * dir;

		// use dir to calculate spherical uvs
		vec2 spherical_uv = getSphericalUVs( dir );

		vec4 color = texture2D(u_color_texture, spherical_uv);
	    gl_FragColor = color;
	}
