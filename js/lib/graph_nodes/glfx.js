(function(global) {
    var LiteGraph = global.LiteGraph;

    //Works with Litegl.js to create WebGL nodes
    if (typeof GL != "undefined") {
        // Texture Lens *****************************************
        function LGraphFXLens() {
            this.addInput("Texture", "Texture");
            this.addInput("Aberration", "number");
            this.addInput("Distortion", "number");
            this.addInput("Blur", "number");
            this.addOutput("Texture", "Texture");
            this.properties = {
                aberration: 1.0,
                distortion: 1.0,
                blur: 1.0,
                precision: LGraphTexture.DEFAULT
            };

            if (!LGraphFXLens._shader) {
                LGraphFXLens._shader = new GL.Shader(
                    GL.Shader.SCREEN_VERTEX_SHADER,
                    LGraphFXLens.pixel_shader
                );
                LGraphFXLens._texture = new GL.Texture(3, 1, {
                    format: gl.RGB,
                    wrap: gl.CLAMP_TO_EDGE,
                    magFilter: gl.LINEAR,
                    minFilter: gl.LINEAR,
                    pixel_data: [255, 0, 0, 0, 255, 0, 0, 0, 255]
                });
            }
        }

        LGraphFXLens.title = "Lens";
        LGraphFXLens.desc = "Camera Lens distortion";
        LGraphFXLens.widgets_info = {
            precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
        };

        LGraphFXLens.prototype.onExecute = function() {
            var tex = this.getInputData(0);
            if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
                this.setOutputData(0, tex);
                return;
            }

            if (!tex) {
                return;
            }

            this._tex = LGraphTexture.getTargetTexture(
                tex,
                this._tex,
                this.properties.precision
            );

            var aberration = this.properties.aberration;
            if (this.isInputConnected(1)) {
                aberration = this.getInputData(1);
                this.properties.aberration = aberration;
            }

            var distortion = this.properties.distortion;
            if (this.isInputConnected(2)) {
                distortion = this.getInputData(2);
                this.properties.distortion = distortion;
            }

            var blur = this.properties.blur;
            if (this.isInputConnected(3)) {
                blur = this.getInputData(3);
                this.properties.blur = blur;
            }

            gl.disable(gl.BLEND);
            gl.disable(gl.DEPTH_TEST);
            var mesh = Mesh.getScreenQuad();
            var shader = LGraphFXLens._shader;
            //var camera = LS.Renderer._current_camera;

            this._tex.drawTo(function() {
                tex.bind(0);
                shader
                    .uniforms({
                        u_texture: 0,
                        u_aberration: aberration,
                        u_distortion: distortion,
                        u_blur: blur
                    })
                    .draw(mesh);
            });

            this.setOutputData(0, this._tex);
        };

        LGraphFXLens.pixel_shader =
            "precision highp float;\n\
			precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform vec2 u_camera_planes;\n\
			uniform float u_aberration;\n\
			uniform float u_distortion;\n\
			uniform float u_blur;\n\
			\n\
			void main() {\n\
				vec2 coord = v_coord;\n\
				float dist = distance(vec2(0.5), coord);\n\
				vec2 dist_coord = coord - vec2(0.5);\n\
				float percent = 1.0 + ((0.5 - dist) / 0.5) * u_distortion;\n\
				dist_coord *= percent;\n\
				coord = dist_coord + vec2(0.5);\n\
				vec4 color = texture2D(u_texture,coord, u_blur * dist);\n\
				color.r = texture2D(u_texture,vec2(0.5) + dist_coord * (1.0+0.01*u_aberration), u_blur * dist ).r;\n\
				color.b = texture2D(u_texture,vec2(0.5) + dist_coord * (1.0-0.01*u_aberration), u_blur * dist ).b;\n\
				gl_FragColor = color;\n\
			}\n\
			";
        /*
			float normalized_tunable_sigmoid(float xs, float k)\n\
			{\n\
				xs = xs * 2.0 - 1.0;\n\
				float signx = sign(xs);\n\
				float absx = abs(xs);\n\
				return signx * ((-k - 1.0)*absx)/(2.0*(-2.0*k*absx+k-1.0)) + 0.5;\n\
			}\n\
		*/

        LiteGraph.registerNodeType("fx/lens", LGraphFXLens);
        global.LGraphFXLens = LGraphFXLens;

        /* not working yet
	function LGraphDepthOfField()
	{
		this.addInput("Color","Texture");
		this.addInput("Linear Depth","Texture");
		this.addInput("Camera","camera");
		this.addOutput("Texture","Texture");
		this.properties = { high_precision: false };
	}

	LGraphDepthOfField.title = "Depth Of Field";
	LGraphDepthOfField.desc = "Applies a depth of field effect";

	LGraphDepthOfField.prototype.onExecute = function()
	{
		var tex = this.getInputData(0);
		var depth = this.getInputData(1);
		var camera = this.getInputData(2);

		if(!tex || !depth || !camera) 
		{
			this.setOutputData(0, tex);
			return;
		}

		var precision = gl.UNSIGNED_BYTE;
		if(this.properties.high_precision)
			precision = gl.half_float_ext ? gl.HALF_FLOAT_OES : gl.FLOAT;			
		if(!this._temp_texture || this._temp_texture.type != precision ||
			this._temp_texture.width != tex.width || this._temp_texture.height != tex.height)
			this._temp_texture = new GL.Texture( tex.width, tex.height, { type: precision, format: gl.RGBA, filter: gl.LINEAR });

		var shader = LGraphDepthOfField._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphDepthOfField._pixel_shader );

		var screen_mesh = Mesh.getScreenQuad();

		gl.disable( gl.DEPTH_TEST );
		gl.disable( gl.BLEND );

		var camera_position = camera.getEye();
		var focus_point = camera.getCenter();
		var distance = vec3.distance( camera_position, focus_point );
		var far = camera.far;
		var focus_range = distance * 0.5;

		this._temp_texture.drawTo( function() {
			tex.bind(0);
			depth.bind(1);
			shader.uniforms({u_texture:0, u_depth_texture:1, u_resolution: [1/tex.width, 1/tex.height], u_far: far, u_focus_point: distance, u_focus_scale: focus_range }).draw(screen_mesh);
		});

		this.setOutputData(0, this._temp_texture);
	}

	//from http://tuxedolabs.blogspot.com.es/2018/05/bokeh-depth-of-field-in-single-pass.html
	LGraphDepthOfField._pixel_shader = "\n\
		precision highp float;\n\
		varying vec2 v_coord;\n\
		uniform sampler2D u_texture; //Image to be processed\n\
		uniform sampler2D u_depth_texture; //Linear depth, where 1.0 == far plane\n\
		uniform vec2 u_iresolution; //The size of a pixel: vec2(1.0/width, 1.0/height)\n\
		uniform float u_far; // Far plane\n\
		uniform float u_focus_point;\n\
		uniform float u_focus_scale;\n\
		\n\
		const float GOLDEN_ANGLE = 2.39996323;\n\
		const float MAX_BLUR_SIZE = 20.0;\n\
		const float RAD_SCALE = 0.5; // Smaller = nicer blur, larger = faster\n\
		\n\
		float getBlurSize(float depth, float focusPoint, float focusScale)\n\
		{\n\
		 float coc = clamp((1.0 / focusPoint - 1.0 / depth)*focusScale, -1.0, 1.0);\n\
		 return abs(coc) * MAX_BLUR_SIZE;\n\
		}\n\
		\n\
		vec3 depthOfField(vec2 texCoord, float focusPoint, float focusScale)\n\
		{\n\
		 float centerDepth = texture2D(u_depth_texture, texCoord).r * u_far;\n\
		 float centerSize = getBlurSize(centerDepth, focusPoint, focusScale);\n\
		 vec3 color = texture2D(u_texture, v_coord).rgb;\n\
		 float tot = 1.0;\n\
		\n\
		 float radius = RAD_SCALE;\n\
		 for (float ang = 0.0; ang < 100.0; ang += GOLDEN_ANGLE)\n\
		 {\n\
		  vec2 tc = texCoord + vec2(cos(ang), sin(ang)) * u_iresolution * radius;\n\
			\n\
		  vec3 sampleColor = texture2D(u_texture, tc).rgb;\n\
		  float sampleDepth = texture2D(u_depth_texture, tc).r * u_far;\n\
		  float sampleSize = getBlurSize( sampleDepth, focusPoint, focusScale );\n\
		  if (sampleDepth > centerDepth)\n\
		   sampleSize = clamp(sampleSize, 0.0, centerSize*2.0);\n\
			\n\
		  float m = smoothstep(radius-0.5, radius+0.5, sampleSize);\n\
		  color += mix(color/tot, sampleColor, m);\n\
		  tot += 1.0;\n\
		  radius += RAD_SCALE/radius;\n\
		  if(radius>=MAX_BLUR_SIZE)\n\
			 return color / tot;\n\
		 }\n\
		 return color / tot;\n\
		}\n\
		void main()\n\
		{\n\
			gl_FragColor = vec4( depthOfField( v_coord, u_focus_point, u_focus_scale ), 1.0 );\n\
			//gl_FragColor = vec4( texture2D(u_depth_texture, v_coord).r );\n\
		}\n\
		";

	LiteGraph.registerNodeType("fx/DOF", LGraphDepthOfField );
	global.LGraphDepthOfField = LGraphDepthOfField;
	*/

        //*******************************************************

        function LGraphFXBokeh() {
            this.addInput("Texture", "Texture");
            this.addInput("Blurred", "Texture");
            this.addInput("Mask", "Texture");
            this.addInput("Threshold", "number");
            this.addOutput("Texture", "Texture");
            this.properties = {
                shape: "",
                size: 10,
                alpha: 1.0,
                threshold: 1.0,
                high_precision: false
            };
        }

        LGraphFXBokeh.title = "Bokeh";
        LGraphFXBokeh.desc = "applies an Bokeh effect";

        LGraphFXBokeh.widgets_info = { shape: { widget: "texture" } };

        LGraphFXBokeh.prototype.onExecute = function() {
            var tex = this.getInputData(0);
            var blurred_tex = this.getInputData(1);
            var mask_tex = this.getInputData(2);
            if (!tex || !mask_tex || !this.properties.shape) {
                this.setOutputData(0, tex);
                return;
            }

            if (!blurred_tex) {
                blurred_tex = tex;
            }

            var shape_tex = LGraphTexture.getTexture(this.properties.shape);
            if (!shape_tex) {
                return;
            }

            var threshold = this.properties.threshold;
            if (this.isInputConnected(3)) {
                threshold = this.getInputData(3);
                this.properties.threshold = threshold;
            }

            var precision = gl.UNSIGNED_BYTE;
            if (this.properties.high_precision) {
                precision = gl.half_float_ext ? gl.HALF_FLOAT_OES : gl.FLOAT;
            }
            if (
                !this._temp_texture ||
                this._temp_texture.type != precision ||
                this._temp_texture.width != tex.width ||
                this._temp_texture.height != tex.height
            ) {
                this._temp_texture = new GL.Texture(tex.width, tex.height, {
                    type: precision,
                    format: gl.RGBA,
                    filter: gl.LINEAR
                });
            }

            //iterations
            var size = this.properties.size;

            var first_shader = LGraphFXBokeh._first_shader;
            if (!first_shader) {
                first_shader = LGraphFXBokeh._first_shader = new GL.Shader(
                    Shader.SCREEN_VERTEX_SHADER,
                    LGraphFXBokeh._first_pixel_shader
                );
            }

            var second_shader = LGraphFXBokeh._second_shader;
            if (!second_shader) {
                second_shader = LGraphFXBokeh._second_shader = new GL.Shader(
                    LGraphFXBokeh._second_vertex_shader,
                    LGraphFXBokeh._second_pixel_shader
                );
            }

            var points_mesh = this._points_mesh;
            if (
                !points_mesh ||
                points_mesh._width != tex.width ||
                points_mesh._height != tex.height ||
                points_mesh._spacing != 2
            ) {
                points_mesh = this.createPointsMesh(tex.width, tex.height, 2);
            }

            var screen_mesh = Mesh.getScreenQuad();

            var point_size = this.properties.size;
            var min_light = this.properties.min_light;
            var alpha = this.properties.alpha;

            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.BLEND);

            this._temp_texture.drawTo(function() {
                tex.bind(0);
                blurred_tex.bind(1);
                mask_tex.bind(2);
                first_shader
                    .uniforms({
                        u_texture: 0,
                        u_texture_blur: 1,
                        u_mask: 2,
                        u_texsize: [tex.width, tex.height]
                    })
                    .draw(screen_mesh);
            });

            this._temp_texture.drawTo(function() {
                //clear because we use blending
                //gl.clearColor(0.0,0.0,0.0,1.0);
                //gl.clear( gl.COLOR_BUFFER_BIT );
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.ONE, gl.ONE);

                tex.bind(0);
                shape_tex.bind(3);
                second_shader
                    .uniforms({
                        u_texture: 0,
                        u_mask: 2,
                        u_shape: 3,
                        u_alpha: alpha,
                        u_threshold: threshold,
                        u_pointSize: point_size,
                        u_itexsize: [1.0 / tex.width, 1.0 / tex.height]
                    })
                    .draw(points_mesh, gl.POINTS);
            });

            this.setOutputData(0, this._temp_texture);
        };

        LGraphFXBokeh.prototype.createPointsMesh = function(
            width,
            height,
            spacing
        ) {
            var nwidth = Math.round(width / spacing);
            var nheight = Math.round(height / spacing);

            var vertices = new Float32Array(nwidth * nheight * 2);

            var ny = -1;
            var dx = (2 / width) * spacing;
            var dy = (2 / height) * spacing;
            for (var y = 0; y < nheight; ++y) {
                var nx = -1;
                for (var x = 0; x < nwidth; ++x) {
                    var pos = y * nwidth * 2 + x * 2;
                    vertices[pos] = nx;
                    vertices[pos + 1] = ny;
                    nx += dx;
                }
                ny += dy;
            }

            this._points_mesh = GL.Mesh.load({ vertices2D: vertices });
            this._points_mesh._width = width;
            this._points_mesh._height = height;
            this._points_mesh._spacing = spacing;

            return this._points_mesh;
        };

        /*
	LGraphTextureBokeh._pixel_shader = "precision highp float;\n\
			varying vec2 a_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform sampler2D u_shape;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D( u_texture, gl_PointCoord );\n\
				color *= v_color * u_alpha;\n\
				gl_FragColor = color;\n\
			}\n";
	*/

        LGraphFXBokeh._first_pixel_shader =
            "precision highp float;\n\
			precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform sampler2D u_texture_blur;\n\
			uniform sampler2D u_mask;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				vec4 blurred_color = texture2D(u_texture_blur, v_coord);\n\
				float mask = texture2D(u_mask, v_coord).x;\n\
			   gl_FragColor = mix(color, blurred_color, mask);\n\
			}\n\
			";

        LGraphFXBokeh._second_vertex_shader =
            "precision highp float;\n\
			attribute vec2 a_vertex2D;\n\
			varying vec4 v_color;\n\
			uniform sampler2D u_texture;\n\
			uniform sampler2D u_mask;\n\
			uniform vec2 u_itexsize;\n\
			uniform float u_pointSize;\n\
			uniform float u_threshold;\n\
			void main() {\n\
				vec2 coord = a_vertex2D * 0.5 + 0.5;\n\
				v_color = texture2D( u_texture, coord );\n\
				v_color += texture2D( u_texture, coord + vec2(u_itexsize.x, 0.0) );\n\
				v_color += texture2D( u_texture, coord + vec2(0.0, u_itexsize.y));\n\
				v_color += texture2D( u_texture, coord + u_itexsize);\n\
				v_color *= 0.25;\n\
				float mask = texture2D(u_mask, coord).x;\n\
				float luminance = length(v_color) * mask;\n\
				/*luminance /= (u_pointSize*u_pointSize)*0.01 */;\n\
				luminance -= u_threshold;\n\
				if(luminance < 0.0)\n\
				{\n\
					gl_Position.x = -100.0;\n\
					return;\n\
				}\n\
				gl_PointSize = u_pointSize;\n\
				gl_Position = vec4(a_vertex2D,0.0,1.0);\n\
			}\n\
			";

        LGraphFXBokeh._second_pixel_shader =
            "precision highp float;\n\
			varying vec4 v_color;\n\
			uniform sampler2D u_shape;\n\
			uniform float u_alpha;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D( u_shape, gl_PointCoord );\n\
				color *= v_color * u_alpha;\n\
				gl_FragColor = color;\n\
			}\n";

        LiteGraph.registerNodeType("fx/bokeh", LGraphFXBokeh);
        global.LGraphFXBokeh = LGraphFXBokeh;

        //************************************************

        function LGraphFXGeneric() {
            this.addInput("Texture", "Texture");
            this.addInput("value1", "number");
            this.addInput("value2", "number");
            this.addOutput("Texture", "Texture");
            this.properties = {
                fx: "halftone",
                value1: 1,
                value2: 1,
                precision: LGraphTexture.DEFAULT
            };
        }

        LGraphFXGeneric.title = "FX";
        LGraphFXGeneric.desc = "applies an FX from a list";

        LGraphFXGeneric.widgets_info = {
            fx: {
                widget: "combo",
                values: ["halftone", "pixelate", "lowpalette", "noise", "gamma"]
            },
            precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
        };
        LGraphFXGeneric.shaders = {};

        LGraphFXGeneric.prototype.onExecute = function() {
            if (!this.isOutputConnected(0)) {
                return;
            } //saves work

            var tex = this.getInputData(0);
            if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
                this.setOutputData(0, tex);
                return;
            }

            if (!tex) {
                return;
            }

            this._tex = LGraphTexture.getTargetTexture(
                tex,
                this._tex,
                this.properties.precision
            );

            //iterations
            var value1 = this.properties.value1;
            if (this.isInputConnected(1)) {
                value1 = this.getInputData(1);
                this.properties.value1 = value1;
            }

            var value2 = this.properties.value2;
            if (this.isInputConnected(2)) {
                value2 = this.getInputData(2);
                this.properties.value2 = value2;
            }

            var fx = this.properties.fx;
            var shader = LGraphFXGeneric.shaders[fx];
            if (!shader) {
                var pixel_shader_code = LGraphFXGeneric["pixel_shader_" + fx];
                if (!pixel_shader_code) {
                    return;
                }

                shader = LGraphFXGeneric.shaders[fx] = new GL.Shader(
                    Shader.SCREEN_VERTEX_SHADER,
                    pixel_shader_code
                );
            }

            gl.disable(gl.BLEND);
            gl.disable(gl.DEPTH_TEST);
            var mesh = Mesh.getScreenQuad();
            var camera = global.LS ? LS.Renderer._current_camera : null;
            var camera_planes;
            if (camera) {
                camera_planes = [
                    LS.Renderer._current_camera.near,
                    LS.Renderer._current_camera.far
                ];
            } else {
                camera_planes = [1, 100];
            }

            var noise = null;
            if (fx == "noise") {
                noise = LGraphTexture.getNoiseTexture();
            }

            this._tex.drawTo(function() {
                tex.bind(0);
                if (fx == "noise") {
                    noise.bind(1);
                }

                shader
                    .uniforms({
                        u_texture: 0,
                        u_noise: 1,
                        u_size: [tex.width, tex.height],
                        u_rand: [Math.random(), Math.random()],
                        u_value1: value1,
                        u_value2: value2,
                        u_camera_planes: camera_planes
                    })
                    .draw(mesh);
            });

            this.setOutputData(0, this._tex);
        };

        LGraphFXGeneric.pixel_shader_halftone =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform vec2 u_camera_planes;\n\
			uniform vec2 u_size;\n\
			uniform float u_value1;\n\
			uniform float u_value2;\n\
			\n\
			float pattern() {\n\
				float s = sin(u_value1 * 3.1415), c = cos(u_value1 * 3.1415);\n\
				vec2 tex = v_coord * u_size.xy;\n\
				vec2 point = vec2(\n\
				   c * tex.x - s * tex.y ,\n\
				   s * tex.x + c * tex.y \n\
				) * u_value2;\n\
				return (sin(point.x) * sin(point.y)) * 4.0;\n\
			}\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				float average = (color.r + color.g + color.b) / 3.0;\n\
				gl_FragColor = vec4(vec3(average * 10.0 - 5.0 + pattern()), color.a);\n\
			}\n";

        LGraphFXGeneric.pixel_shader_pixelate =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform vec2 u_camera_planes;\n\
			uniform vec2 u_size;\n\
			uniform float u_value1;\n\
			uniform float u_value2;\n\
			\n\
			void main() {\n\
				vec2 coord = vec2( floor(v_coord.x * u_value1) / u_value1, floor(v_coord.y * u_value2) / u_value2 );\n\
				vec4 color = texture2D(u_texture, coord);\n\
				gl_FragColor = color;\n\
			}\n";

        LGraphFXGeneric.pixel_shader_lowpalette =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform vec2 u_camera_planes;\n\
			uniform vec2 u_size;\n\
			uniform float u_value1;\n\
			uniform float u_value2;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				gl_FragColor = floor(color * u_value1) / u_value1;\n\
			}\n";

        LGraphFXGeneric.pixel_shader_noise =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform sampler2D u_noise;\n\
			uniform vec2 u_size;\n\
			uniform float u_value1;\n\
			uniform float u_value2;\n\
			uniform vec2 u_rand;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				vec3 noise = texture2D(u_noise, v_coord * vec2(u_size.x / 512.0, u_size.y / 512.0) + u_rand).xyz - vec3(0.5);\n\
				gl_FragColor = vec4( color.xyz + noise * u_value1, color.a );\n\
			}\n";

        LGraphFXGeneric.pixel_shader_gamma =
            "precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform float u_value1;\n\
			\n\
			void main() {\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				float gamma = 1.0 / u_value1;\n\
				gl_FragColor = vec4( pow( color.xyz, vec3(gamma) ), color.a );\n\
			}\n";

        LiteGraph.registerNodeType("fx/generic", LGraphFXGeneric);
        global.LGraphFXGeneric = LGraphFXGeneric;

        // Vigneting ************************************

        function LGraphFXVigneting() {
            this.addInput("Tex.", "Texture");
            this.addInput("intensity", "number");

            this.addOutput("Texture", "Texture");
            this.properties = {
                intensity: 1,
                invert: false,
                precision: LGraphTexture.DEFAULT
            };

            if (!LGraphFXVigneting._shader) {
                LGraphFXVigneting._shader = new GL.Shader(
                    Shader.SCREEN_VERTEX_SHADER,
                    LGraphFXVigneting.pixel_shader
                );
            }
        }

        LGraphFXVigneting.title = "Vigneting";
        LGraphFXVigneting.desc = "Vigneting";

        LGraphFXVigneting.widgets_info = {
            precision: { widget: "combo", values: LGraphTexture.MODE_VALUES }
        };

        LGraphFXVigneting.prototype.onExecute = function() {
            var tex = this.getInputData(0);

            if (this.properties.precision === LGraphTexture.PASS_THROUGH) {
                this.setOutputData(0, tex);
                return;
            }

            if (!tex) {
                return;
            }

            this._tex = LGraphTexture.getTargetTexture(
                tex,
                this._tex,
                this.properties.precision
            );

            var intensity = this.properties.intensity;
            if (this.isInputConnected(1)) {
                intensity = this.getInputData(1);
                this.properties.intensity = intensity;
            }

            gl.disable(gl.BLEND);
            gl.disable(gl.DEPTH_TEST);

            var mesh = Mesh.getScreenQuad();
            var shader = LGraphFXVigneting._shader;
            var invert = this.properties.invert;

            this._tex.drawTo(function() {
                tex.bind(0);
                shader
                    .uniforms({
                        u_texture: 0,
                        u_intensity: intensity,
                        u_isize: [1 / tex.width, 1 / tex.height],
                        u_invert: invert ? 1 : 0
                    })
                    .draw(mesh);
            });

            this.setOutputData(0, this._tex);
        };

        LGraphFXVigneting.pixel_shader =
            "precision highp float;\n\
			precision highp float;\n\
			varying vec2 v_coord;\n\
			uniform sampler2D u_texture;\n\
			uniform float u_intensity;\n\
			uniform int u_invert;\n\
			\n\
			void main() {\n\
				float luminance = 1.0 - length( v_coord - vec2(0.5) ) * 1.414;\n\
				vec4 color = texture2D(u_texture, v_coord);\n\
				if(u_invert == 1)\n\
					luminance = 1.0 - luminance;\n\
				luminance = mix(1.0, luminance, u_intensity);\n\
			   gl_FragColor = vec4( luminance * color.xyz, color.a);\n\
			}\n\
			";

        LiteGraph.registerNodeType("fx/vigneting", LGraphFXVigneting);
        global.LGraphFXVigneting = LGraphFXVigneting;
    }

    ///@INFO: GRAPHS
if(typeof(LiteGraph) != "undefined")
{

var litegraph_texture_found = false;
if(typeof(LGraphTexture) == "undefined")
	console.error("LiteGraph found but no LGraphTexture, this means LiteGL wasnt not included BEFORE litegraph. Be sure to include LiteGL before LiteGraph to ensure all functionalities.");
else
	litegraph_texture_found = true;



// Texture Blur *****************************************
function LGraphFXStack()
{
	this.addInput("Color","Texture");
	this.addInput("Depth","Texture");
	this.addInput("Intensity","number");
	this.addOutput("Final","Texture");
	this.properties = { intensity: 1, preserve_aspect: true };

	this._fx_stack = new LS.FXStack();
	this._fx_options = {};
}

LGraphFXStack.title = "FXStack";
LGraphFXStack.desc = "Apply FXs to Texture";

LGraphFXStack.prototype.onExecute = function()
{
	var tex = this.getInputData(0);
	if(!tex)
		return;

	if(!this.isOutputConnected(0))
		return; //saves work

	var temp = this._final_texture;

	if(!temp || temp.width != tex.width || temp.height != tex.height || temp.type != tex.type )
	{
		//we need two textures to do the blurring
		this._final_texture = new GL.Texture( tex.width, tex.height, { type: tex.type, format: gl.RGBA, filter: gl.LINEAR });
	}

	if( this.isInputConnected(1) )
		this._fx_options.depth_texture = this.getInputData(1);

	var intensity = this.properties.intensity;
	if( this.isInputConnected(2) )
	{
		intensity = this.getInputData(2);
		this.properties.intensity = intensity;
	}

	//blur sometimes needs an aspect correction
	var aspect = LiteGraph.camera_aspect;
	if(!aspect && window.gl !== undefined)
		aspect = gl.canvas.height / gl.canvas.width;
	if(!aspect)
		aspect = 1;
	aspect = this.properties.preserve_aspect ? aspect : 1;

	this._fx_stack.applyFX( tex, this._final_texture, this._fx_options );

	this.setOutputData(0, this._final_texture);
}

LGraphFXStack.prototype.onInspect = function( inspector )
{
	return this._fx_stack.inspect( inspector );
}

LGraphFXStack.prototype.getResources = function( resources )
{
	return this._fx_stack.getResources( resources );
}

LGraphFXStack.prototype.onSerialize = function( o )
{
	o.stack = this._fx_stack.serialize();
}

LGraphFXStack.prototype.onConfigure = function( o )
{
	if(o.stack)
		this._fx_stack.configure( o.stack );
}

LiteGraph.registerNodeType("texture/fxstack", LGraphFXStack );


function LGraphHistogram()
{
	this.addInput("in","Texture");
	this.addInput("enabled","Boolean");
	this.addOutput("out","Texture");
	this.properties = { enabled: true, scale: 0.5, position: [0,0], size: [1,1] };
}

LGraphHistogram.title = "Histogram";
LGraphHistogram.desc = "Overlaps an histogram";
LGraphHistogram.priority = 2; //render at the end

LGraphHistogram.prototype.onExecute = function()
{
	var tex = this.getInputData(0);

	if( !tex )
		return; //saves work

	var enabled = this.getInputData(1);
	if(enabled != null)
		this.properties.enabled = Boolean( enabled );

	if(this.properties.precision === LGraphTexture.PASS_THROUGH || this.properties.enabled === false )
	{
		this.setOutputData(0, tex);
		return;
	}

	if(!this._points_mesh)
	{
		var w = 512;
		var h = 256;
		var vertices = new Float32Array(w*h*3);
		for(var y = 0; y < h; ++y)
			for(var x = 0; x < w; ++x)
				vertices.set([x/w,y/h,0], y*w*3 + x*3);
		this._points_mesh = GL.Mesh.load({ vertices: vertices });
	}

	var histogram_bins = 256;

	if(!this._texture)
		this._texture = new GL.Texture(histogram_bins,1,{ type: gl.FLOAT, magFilter: gl.LINEAR, format: gl.RGB});

	if(!LGraphHistogram._shader)
		LGraphHistogram._shader = new GL.Shader( LGraphHistogram.vertex_shader, LGraphHistogram.pixel_shader );

	var mesh = this._points_mesh;
	var shader = LGraphHistogram._shader;
	var scale = this.properties.scale;
	shader.setUniform("u_texture",0);
	shader.setUniform("u_factor",1/512);
	tex.bind(0);

	gl.disable(gl.DEPTH_TEST);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE,gl.ONE);

	//compute
	this._texture.drawTo( function(){
		gl.clearColor(0,0,0,1);
		gl.clear( gl.COLOR_BUFFER_BIT );
		for(var i = 0; i < 3; ++i)
		{
			gl.colorMask( i == 0, i == 1, i == 2, true );
			shader.setUniform("u_mask",LGraphHistogram.masks[i]);
			shader.draw( mesh, gl.POINTS );
		}
		gl.colorMask( true,true,true, true );
	});

	if(!this._line_mesh)
	{
		var vertices = new Float32Array(histogram_bins*3);
		for(var x = 0; x < histogram_bins; ++x)
			vertices.set([x/histogram_bins,0,0], x*3);
		this._line_mesh = GL.Mesh.load({ vertices: vertices });
	}

	if(!LGraphHistogram._line_shader)
		LGraphHistogram._line_shader = new GL.Shader( LGraphHistogram.line_vertex_shader, LGraphHistogram.line_pixel_shader );

	var mesh = this._line_mesh;
	var shader = LGraphHistogram._line_shader;
	shader.setUniform("u_texture",0);
	shader.setUniform("u_scale",scale);
	this._texture.bind(0);
	gl.disable(gl.BLEND);

	gl.viewport( this.properties.position[0] * gl.canvas.width, this.properties.position[1] * gl.canvas.height, 
				this.properties.size[0] * gl.canvas.width, this.properties.size[1] * gl.canvas.height );

	for(var i = 0; i < 3; ++i)
	{
		shader.setUniform("u_mask",LGraphHistogram.masks[i]);
		shader.draw( mesh, gl.LINE_STRIP );
	}

	this.setOutputData(0, this._texture );

	gl.viewport( 0,0, gl.canvas.width, gl.canvas.height );
}

LGraphHistogram.masks = [vec3.fromValues(1,0,0),vec3.fromValues(0,1,0),vec3.fromValues(0,0,1)];

LGraphHistogram.vertex_shader = "precision highp float;\n\
	\n\
	attribute vec3 a_vertex;\n\
	uniform sampler2D u_texture;\n\
	uniform vec3 u_mask;\n\
	\n\
	void main() {\n\
		vec3 color = texture2D( u_texture, a_vertex.xy ).xyz * u_mask;\n\
		float pos = min(1.0,length(color));\n\
		gl_Position = vec4(pos*2.0-1.0,0.5,0.0,1.0);\n\
		gl_PointSize = 1.0;\n\
	}\n\
";

LGraphHistogram.pixel_shader = "precision highp float;\n\
	uniform float u_factor;\n\
	void main() {\n\
		gl_FragColor = vec4(u_factor);\n\
	}\n\
";

LGraphHistogram.line_vertex_shader = "precision highp float;\n\
	\n\
	attribute vec3 a_vertex;\n\
	uniform sampler2D u_texture;\n\
	uniform vec3 u_mask;\n\
	uniform float u_scale;\n\
	\n\
	void main() {\n\
		vec3 color = texture2D( u_texture, a_vertex.xy ).xyz * u_mask;\n\
		float pos = length(color);\n\
		gl_Position = vec4(a_vertex.x*2.0-1.0, u_scale*pos*2.0-1.0,0.0,1.0);\n\
	}\n\
";

LGraphHistogram.line_pixel_shader = "precision highp float;\n\
	uniform vec3 u_mask;\n\
	void main() {\n\
		gl_FragColor = vec4(u_mask,1.0);\n\
	}\n\
";

LiteGraph.registerNodeType("texture/histogram", LGraphHistogram );


function LGraphCameraMotionBlur()
{
	this.addInput("color","Texture");
	this.addInput("depth","Texture");
	this.addInput("camera","Camera");
	this.addOutput("out","Texture");
	this.properties = { enabled: true, intensity: 1, ghosting_mitigation: true, ghosting_threshold: 0.4, freeze_camera: false, low_quality: false, precision: LGraphTexture.DEFAULT };

	this._inv_matrix = mat4.create();
	this._previous_viewprojection_matrix = mat4.create();

	this._uniforms = { 
		u_color_texture:0,
		u_depth_texture:1,
		u_inv_vp: this._inv_matrix,
		u_intensity: 1,
		u_camera_planes: null,
		u_viewprojection_matrix: null,
		u_previous_viewprojection_matrix: this._previous_viewprojection_matrix
	};
}

LGraphCameraMotionBlur.widgets_info = {
	"precision": { widget:"combo", values: litegraph_texture_found ? LGraphTexture.MODE_VALUES : [] }
};

LGraphCameraMotionBlur.title = "Camera Motion Blur";
LGraphCameraMotionBlur.desc = "A motion blur but only for camera movement";

LGraphCameraMotionBlur.prototype.onExecute = function()
{
	var tex = this.getInputData(0);
	var depth = this.getInputData(1);
	var camera = this.getInputData(2);

	if( !this.isOutputConnected(0) || !tex || !depth || !camera)
		return; //saves work

	var enabled = this.getInputData(3);
	if(enabled != null)
		this.properties.enabled = Boolean( enabled );

	if(this.properties.precision === LGraphTexture.PASS_THROUGH || this.properties.enabled === false )
	{
		this.setOutputData(0, tex);
		return;
	}

	var width = tex.width;
	var height = tex.height;
	var type = this.precision === LGraphTexture.LOW ? gl.UNSIGNED_BYTE : gl.HIGH_PRECISION_FORMAT;
	if (this.precision === LGraphTexture.DEFAULT)
		type = tex.type;
	if(!this._tex || this._tex.width != width || this._tex.height != height || this._tex.type != type )
		this._tex = new GL.Texture( width, height, { type: type, format: gl.RGBA, filter: gl.LINEAR });

	if( this.properties.low_quality )
	{
		if(!LGraphCameraMotionBlur._shader_low)
		{
			LGraphCameraMotionBlur._shader_low = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphCameraMotionBlur.pixel_shader, { SAMPLES:"4" } );
			LGraphCameraMotionBlur._shader_no_ghosting_low = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphCameraMotionBlur.pixel_shader, { GHOST_CORRECTION: "", SAMPLES:"4" } );
		}
	}
	else
	{
		if(!LGraphCameraMotionBlur._shader)
		{
			LGraphCameraMotionBlur._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphCameraMotionBlur.pixel_shader );
			LGraphCameraMotionBlur._shader_no_ghosting = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphCameraMotionBlur.pixel_shader, { GHOST_CORRECTION: "" } );
		}
	}

	var shader = null;
	
	if( this.properties.low_quality )
		shader = this.properties.ghosting_mitigation ? LGraphCameraMotionBlur._shader_no_ghosting_low : LGraphCameraMotionBlur._shader_low;
	else
		shader = this.properties.ghosting_mitigation ? LGraphCameraMotionBlur._shader_no_ghosting : LGraphCameraMotionBlur._shader;

	var inv = this._inv_matrix;
	var vp = camera._viewprojection_matrix;
	var prev = this._previous_viewprojection_matrix;
	var optimize = false; //skip algorithm when camera hasnt moved
	var intensity = this.properties.intensity;

	var uniforms = this._uniforms;
	uniforms.u_intensity = intensity;
	uniforms.u_viewprojection_matrix =  camera._viewprojection_matrix;
	uniforms.u_camera_planes =  camera._uniforms.u_camera_planes;
	uniforms.u_ghosting_threshold = this.properties.ghosting_threshold || 0.4;

	var diff = 0;
	for(var i = 0; i < prev.length; ++i)
		diff += Math.abs( vp[i] - prev[i] );
	if(diff < 0.0001 && optimize) //no camera movement, skip process
	{
		tex.copyTo( this._tex );
	}
	else
	{
		mat4.invert( inv, camera._viewprojection_matrix );
		this._tex.drawTo(function() {
			gl.disable( gl.DEPTH_TEST );
			gl.disable( gl.CULL_FACE );
			gl.disable( gl.BLEND );
			tex.bind(0);
			depth.bind(1);
			var mesh = GL.Mesh.getScreenQuad();
			shader.uniforms( uniforms ).draw( mesh );
		});
	}

	if(!this.properties.freeze_camera)
		prev.set( camera._viewprojection_matrix );

	this.setOutputData( 0, this._tex );
}

LGraphCameraMotionBlur.prototype.onGetInputs = function()
{
	return [["enabled","boolean"]];
}

LGraphCameraMotionBlur.pixel_shader = "precision highp float;\n\
		\n\
		uniform sampler2D u_color_texture;\n\
		uniform sampler2D u_depth_texture;\n\
		varying vec2 v_coord;\n\
		uniform mat4 u_inv_vp;\n\
		uniform mat4 u_viewprojection_matrix;\n\
		uniform mat4 u_previous_viewprojection_matrix;\n\
		uniform vec2 u_camera_planes;\n\
		uniform float u_intensity;\n\
		uniform float u_ghosting_threshold;\n\
		#ifndef SAMPLES\n\
			#define SAMPLES 16\n\
		#endif\n\
		\n\
		void main() {\n\
			vec2 uv = v_coord;\n\
			float depth = texture2D(u_depth_texture, uv).x;\n\
			float zNear = u_camera_planes.x;\n\
			float zFar = u_camera_planes.y;\n\
			//float z = (2.0 * zNear) / (zFar + zNear - depth * (zFar - zNear));\n\
			depth = depth * 2.0 - 1.0;\n\
			float z = zNear * (depth + 1.0) / (zFar + zNear - depth * (zFar - zNear));\n\
			vec4 screenpos = vec4( uv * 2.0 - vec2(1.0), depth, 1.0 );\n\
			vec4 pos = u_inv_vp * screenpos;\n\
			pos /= pos.w;\n\
			vec4 old_screenpos = u_previous_viewprojection_matrix * pos;\n\
			old_screenpos /= old_screenpos.w;\n\
			vec2 uv_final = old_screenpos.xy * 0.5 + vec2(0.5);\n\
			vec2 uv_delta = (uv_final - uv);\n\
			uv -= uv_delta * 0.5;\n\
			//uv_delta *= 1.0 - z;\n\
			uv_delta *= u_intensity / float(SAMPLES);\n\
			vec4 color = vec4(0.0);\n\
			float total = 0.0;\n\
			float amount = 1.0;\n\
			for(int i = 0; i < SAMPLES; ++i)\n\
			{\n\
				#ifdef GHOST_CORRECTION\n\
					float old_depth = texture2D(u_depth_texture, uv).x;\n\
					old_depth = old_depth * 2.0 - 1.0;\n\
					float old_z = zNear * (old_depth + 1.0) / (zFar + zNear - old_depth * (zFar - zNear));\n\
					if( abs(old_z - z) > u_ghosting_threshold )\n\
					{\n\
						uv += uv_delta;\n\
						continue;\n\
					}\n\
				#endif\n\
				color += texture2D( u_color_texture, uv );\n\
				uv += uv_delta;\n\
				total += amount;\n\
			}\n\
			gl_FragColor = color / total;\n\
			//gl_FragColor = vec4( abs( old_screenpos.xy ), 1.0, 1.0 );\n\
			//gl_FragColor = texture2D( u_color_texture, uv_final );\n\
			//gl_FragColor = vec4( abs( pos.xyz * 0.001 ), 1.0 );\n\
			//gl_FragColor = vec4( vec3( abs(old_z - z) ), 1.0);\n\
		}\n\
		";

LiteGraph.registerNodeType("texture/motionBlur", LGraphCameraMotionBlur );


function LGraphVolumetricLight()
{
	this.addInput("color","Texture");
	this.addInput("depth","Texture");
	this.addInput("camera","Camera");
	this.addInput("light","Light,Component");
	this.addOutput("out","Texture");
	this.properties = { enabled: true, intensity: 1, attenuation: 2.0, precision: LGraphTexture.DEFAULT };

	this._inv_matrix = mat4.create();

	this._uniforms = { 
		u_color_texture:0,
		u_depth_texture:1,
		u_shadow_texture:2,
		u_noise_texture:3,
		u_intensity: 1,
		u_camera_planes: null,
		u_inv_vp: this._inv_matrix,
		u_rand: vec2.create()
	};
}

LGraphVolumetricLight.widgets_info = {
	"precision": { widget:"combo", values: LGraphTexture.MODE_VALUES }
};

LGraphVolumetricLight.title = "Volumetric Light";
LGraphVolumetricLight.desc = "Adds fog with volumetric light";

LGraphVolumetricLight.prototype.onExecute = function()
{
	var tex = this.getInputData(0);
	var depth = this.getInputData(1);
	var camera = this.getInputData(2);
	var light = this.getInputData(3);

	if( !this.isOutputConnected(0))
		return; //saves work

	var enabled = this.getInputData(4);
	if(enabled != null)
		this.properties.enabled = Boolean( enabled );

	var shadowmap = null;
	if(light && light._shadowmap)
		shadowmap = light._shadowmap.texture;

	if(this.properties.precision === LGraphTexture.PASS_THROUGH || this.properties.enabled === false || !depth || !camera || !light || !shadowmap )
	{
		this.setOutputData(0, tex);
		return;
	}

	var width = depth.width;
	var height = depth.height;
	var type = this.precision === LGraphTexture.LOW ? gl.UNSIGNED_BYTE : gl.HIGH_PRECISION_FORMAT;
	if (this.precision === LGraphTexture.DEFAULT)
		type = tex ? tex.type : gl.UNSIGNED_BYTE;
	if(!this._tex || this._tex.width != width || this._tex.height != height || this._tex.type != type )
		this._tex = new GL.Texture( width, height, { type: type, format: gl.RGBA, filter: gl.LINEAR });

	if(!LGraphVolumetricLight._shader_spot)
	{
		LGraphVolumetricLight._shader_spot = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphVolumetricLight.pixel_shader, { USE_SPOT:"" } );
		LGraphVolumetricLight._shader_directional = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphVolumetricLight.pixel_shader, { USE_DIRECTIONAL:"" } );
		//LGraphVolumetricLight._shader_omni = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphVolumetricLight.pixel_shader, { USE_OMNI:"" } );
	}

	var shader = null;

	switch( light.type )
	{
		case LS.Light.SPOT: shader = LGraphVolumetricLight._shader_spot; break;
		case LS.Light.DIRECTIONAL: shader = LGraphVolumetricLight._shader_directional; break;
		case LS.Light.OMNI: //shader = LGraphVolumetricLight._shader_omni;
			//not supported yet
			console.warn("volumetric light not supported for omni lights");
			this.properties.enabled = false;
			return;
			break;
		default:
			return;
	}

	var vp = camera._viewprojection_matrix;
	var intensity = this.properties.intensity;
	var inv = this._inv_matrix;
	mat4.invert( inv, camera._viewprojection_matrix );

	var uniforms = this._uniforms;
	uniforms.u_intensity = intensity;
	uniforms.u_camera_planes = camera._uniforms.u_camera_planes;
	uniforms.u_shadow_params = light._uniforms.u_shadow_params;
	uniforms.u_attenuation = this.properties.attenuation;
	uniforms.u_rand[1] = uniforms.u_rand[0] = 0;

	var light_uniforms = light._uniforms;

	if(!tex)
		tex = LS.Renderer._black_texture;
	var noise_texture = LGraphTexture.getNoiseTexture();

	this._tex.drawTo(function() {
		gl.disable( gl.DEPTH_TEST );
		gl.disable( gl.CULL_FACE );
		gl.disable( gl.BLEND );

		if(!light.enabled)
			tex.toViewport();
		else
		{
			tex.bind(0);
			depth.bind(1);
			shadowmap.bind(2);
			noise_texture.bind(3);
			var mesh = GL.Mesh.getScreenQuad();
			shader.uniforms( light_uniforms );
			shader.uniforms( uniforms ).draw( mesh );
		}
	});

	this.setOutputData( 0, this._tex );
}

LGraphVolumetricLight.prototype.onGetInputs = function()
{
	return [["enabled","boolean"]];
}

/* from http://www.alexandre-pestana.com/volumetric-lights/
// Mie scaterring approximated with Henyey-Greenstein phase function.

accumFog += ComputeScattering(dot(rayDirection, sunDirection)).xxx * g_SunColor;
*/

LGraphVolumetricLight.pixel_shader = "precision highp float;\n\
		\n\
		uniform sampler2D u_color_texture;\n\
		uniform sampler2D u_depth_texture;\n\
		uniform sampler2D u_shadow_texture;\n\
		uniform sampler2D u_noise_texture;\n\
		varying vec2 v_coord;\n\
		uniform mat4 u_inv_vp;\n\
		uniform mat4 u_light_viewprojection_matrix;\n\
		uniform vec2 u_camera_planes;\n\
		uniform vec4 u_shadow_params;\n\
		uniform vec4 u_light_info;\n\
		uniform vec3 u_light_front;\n\
		uniform vec3 u_light_color;\n\
		uniform mat4 u_light_matrix;\n\
		uniform float u_intensity;\n\
		uniform float u_attenuation;\n\
		uniform vec2 u_rand;\n\
		const float G_SCATTERING = 0.5;\n\
		const float PI = 3.14159265358979323846;\n\
		float ComputeScattering(float lightDotView)\n\
		{\n\
			float result = 1.0 - G_SCATTERING * G_SCATTERING;\n\
			result /= (4.0 * PI * pow(1.0 + G_SCATTERING * G_SCATTERING - (2.0 * G_SCATTERING) * lightDotView, 1.5));\n\
			return result;\n\
		}\n\
		#define SAMPLES 64\n\
		\n\
		void main() {\n\
			vec2 uv = v_coord;\n\
			vec4 color = texture2D(u_color_texture, uv);\n\
			float depth = texture2D(u_depth_texture, uv).x;\n\
			float zNear = u_camera_planes.x;\n\
			float zFar = u_camera_planes.y;\n\
			depth = depth * 2.0 - 1.0;\n\
			float z = zNear * (depth + 1.0) / (zFar + zNear - depth * (zFar - zNear));\n\
			vec4 screenpos = vec4( uv * 2.0 - vec2(1.0), depth, 1.0 );\n\
			vec4 farpos = u_inv_vp * screenpos;\n\
			farpos /= farpos.w;\n\
			screenpos.z = 0.0;\n\
			vec4 nearpos = u_inv_vp * screenpos;\n\
			nearpos.xyz /= nearpos.w;\n\
			vec3 rayDir = (farpos.xyz - nearpos.xyz) / float(SAMPLES);\n\
			float weight = length(rayDir);\n\
			vec4 current_pos = vec4( nearpos.xyz, 1.0 );\n\
			current_pos.xyz += rayDir * texture2D(u_noise_texture, uv * 2.0 + u_rand ).x;\n\
			float brightness = 0.0;\n\
			float bias = u_shadow_params.y;\n\
			float accum = ComputeScattering( dot( normalize(rayDir), -u_light_front));\n\
			for(int i = 0; i < SAMPLES; ++i)\n\
			{\n\
				vec4 light_uv = u_light_matrix * current_pos;\n\
				light_uv.xy /= light_uv.w;\n\
				light_uv.xy = light_uv.xy * 0.5 + vec2(0.5);\n\
				float shadow_depth = texture2D( u_shadow_texture, light_uv.xy ).x;\n\
				if (((light_uv.z - bias) / light_uv.w * 0.5 + 0.5) < shadow_depth )\n\
					brightness += accum * weight;\n\
				current_pos.xyz += rayDir;\n\
			}\n\
			//color.xyz += u_intensity * u_light_color * brightness / float(SAMPLES);\n\
			color.xyz = mix(color.xyz, u_light_color, clamp( pow(u_intensity * brightness / float(SAMPLES), u_attenuation),0.0,1.0));\n\
			gl_FragColor = color;\n\
		}\n\
		";

LiteGraph.registerNodeType("texture/volumetric_light", LGraphVolumetricLight );

if( LiteGraph.Nodes.LGraphTextureCanvas2D )
{

	function LGraphTextureCanvas2DFromScript() {
        this.addInput("v");
		this.addOutput("out", "Texture");
		this.properties = {
			filename: "",
			width: 512,
			height: 512,
			clear: true,
			precision: LGraphTexture.DEFAULT,
			use_html_canvas: false
		};
		this._func = null;
		this._temp_texture = null;
		this.size = [180,30];
	}

	LGraphTextureCanvas2DFromScript.title = "Canvas2DFromScript";
	LGraphTextureCanvas2DFromScript.desc = "Executes Canvas2D script file inside a texture or the viewport.";
	LGraphTextureCanvas2DFromScript.help = "Set width and height to 0 to match viewport size.";

	LGraphTextureCanvas2DFromScript.widgets_info = {
		precision: { widget: "combo", values: LGraphTexture.MODE_VALUES },
		filename: { type: "script" },
		width: { type: "Number", precision: 0, step: 1 },
		height: { type: "Number", precision: 0, step: 1 }
	};

	LGraphTextureCanvas2DFromScript.prototype.onPropertyChanged = function(	name, value ) {
		var that = this;
		if (name == "filename" && LiteGraph.allow_scripts) {
			this._func = null;
			if(!value)
				return;
			LS.ResourcesManager.load( value, function(script_resource){
				that.compileCode(script_resource.data);
				that._code_version = script_resource._version || 0;
			});
		}
	}

	LGraphTextureCanvas2DFromScript.prototype.onExecute = function() {

		if (!this.isOutputConnected(0))
			return;

		var script_resource = LS.ResourcesManager.getResource( this.properties.filename );
		if( script_resource && script_resource._version != this._code_version )
		{
			this.compileCode( script_resource.data );
			this._code_version = script_resource._version || 0;
		}

		var func = this._func;
		if (!func)
			return;
		this.executeDraw( func );
	}

	LGraphTextureCanvas2DFromScript.prototype.getResources = function(res)
	{
		if(this.properties.filename)
			res[this.properties.filename] = true;
	}


	LGraphTextureCanvas2DFromScript.prototype.compileCode = LiteGraph.Nodes.LGraphTextureCanvas2D.prototype.compileCode;

	LGraphTextureCanvas2DFromScript.prototype.compileCode = LiteGraph.Nodes.LGraphTextureCanvas2D.prototype.compileCode;
	LGraphTextureCanvas2DFromScript.prototype.executeDraw = LiteGraph.Nodes.LGraphTextureCanvas2D.prototype.executeDraw;

	LiteGraph.registerNodeType("texture/canvas2DfromScript", LGraphTextureCanvas2DFromScript);
}
/*
function LGraphDepthAwareUpscale()
{
	this.addInput("tex","Texture");
	this.addInput("lowdepth","Texture");
	this.addInput("highdepth","Texture");
	this.addInput("camera","Camera");
	this.addOutput("out","Texture");
	this.properties = { enabled: true, precision: LGraphTexture.DEFAULT };

	this._uniforms = { 
		u_color_texture:0,
		u_lowdepth_texture:1,
		u_highdepth_texture:2,
		u_lowsize: vec4.create(),
		u_highsize: vec4.create(),
		u_viewprojection: null
	};
}

LGraphDepthAwareUpscale.widgets_info = {
	"precision": { widget:"combo", values: LGraphTexture.MODE_VALUES }
};

LGraphDepthAwareUpscale.title = "DepthAware Upscale";
LGraphDepthAwareUpscale.desc = "Upscales a texture";

LGraphDepthAwareUpscale.prototype.onExecute = function()
{
	var tex = this.getInputData(0);
	var lowdepth = this.getInputData(1);
	var highdepth = this.getInputData(2);
	var camera = this.getInputData(3);

	if( !this.isOutputConnected(0) || !tex )
		return; //saves work

	var enabled = this.getInputData(4);
	if(enabled != null)
		this.properties.enabled = Boolean( enabled );

	if(this.properties.precision === LGraphTexture.PASS_THROUGH || this.properties.enabled === false || !lowdepth || !highdepth || !camera )
	{
		this.setOutputData(0, tex);
		return;
	}

	var width = tex.width;
	var height = tex.height;
	var type = this.precision === LGraphTexture.LOW ? gl.UNSIGNED_BYTE : gl.HIGH_PRECISION_FORMAT;
	if (this.precision === LGraphTexture.DEFAULT)
		type = tex ? tex.type : gl.UNSIGNED_BYTE;
	if(!this._tex || this._tex.width != width || this._tex.height != height || this._tex.type != type || this._tex.format != tex.format )
		this._tex = new GL.Texture( width, height, { type: type, format: tex.format, filter: gl.LINEAR });

	if(!LGraphDepthAwareUpscale._shader)
		LGraphDepthAwareUpscale._shader = new GL.Shader( GL.Shader.SCREEN_VERTEX_SHADER, LGraphDepthAwareUpscale.pixel_shader );

	var shader = null;

	var uniforms = this._uniforms;
	uniforms.u_lowsize[0] = lowdepth.width; uniforms.u_lowsize[1] = lowdepth.height; 	uniforms.u_lowsize[2] = 1/lowdepth.width; uniforms.u_lowsize[3] = 1/lowdepth.height;
	uniforms.u_highsize[0] = highdepth.width; uniforms.u_highsize[1] = highdepth.height; uniforms.u_highsize[2] = 1/highdepth.width; uniforms.u_highsize[3] = 1/highdepth.height;
	uniforms.u_viewprojection = camera._viewprojection_matrix;

	this._tex.drawTo(function() {
		gl.disable( gl.DEPTH_TEST );
		gl.disable( gl.CULL_FACE );
		gl.disable( gl.BLEND );
		tex.bind(0);
		lowdepth.bind(1);
		highdepth.bind(2);
		var mesh = GL.Mesh.getScreenQuad();
		shader.uniforms( uniforms ).draw( mesh );
	});

	this.setOutputData( 0, this._tex );
}

LGraphDepthAwareUpscale.pixel_shader = "precision highp float;\n\
		\n\
		uniform sampler2D u_color_texture;\n\
		uniform sampler2D u_lowdepth_texture;\n\
		uniform sampler2D u_highdepth_texture;\n\
		varying vec2 v_coord;\n\
		uniform vec4 u_lowsize;\n\
		uniform vec4 u_highsize;\n\
		uniform mat4 u_viewprojection;\n\
		\n\
		void main() {\n\
			vec2 uv = v_coord;\n\
			vec2 low_ltuv = floor(v_coord * u_lowsize.xy) * u_lowsize.zw;\n\
			vec2 low_rbuv = ceil(v_coord * u_lowsize.xy) * u_lowsize.zw;\n\
			vec2 high_ltuv = floor(v_coord * u_highsize.xy) * u_highsize.zw;\n\
			vec2 high_rbuv = ceil(v_coord * u_highsize.xy) * u_highsize.zw;\n\
			vec4 color = texture2D(u_color_texture, uv);\n\
			float lowdepth = texture2D(u_lowdepth_texture, uv).x;\n\
			float highdepth = texture2D(u_highdepth_texture, uv).x;\n\
			color.xyz = mix(color.xyz, u_light_color, clamp( pow(u_intensity * brightness / float(SAMPLES), u_attenuation),0.0,1.0));\n\
			gl_FragColor = color;\n\
		}\n\
		";

LiteGraph.registerNodeType("texture/depthaware_upscale", LGraphDepthAwareUpscale );
*/


}
})(this);
