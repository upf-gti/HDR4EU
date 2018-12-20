
/*
	List of components to use in the app
	Show them in the gui
*/

function Tonemapper()
{
    if(this.constructor !== Tonemapper)
        throw("Use new");

    this.uniforms = {};
}

WS.Tonemapper = Tonemapper;

Tonemapper.prototype.apply = function(input, output)
{
	var shader = this.shader;

	if(!shader)
	throw('Shader missing');	

	if(!input)
	throw('Input texture missing');	

    // Join renderer uniforms with own uniforms
	var uniforms = Object.assign(renderer._uniforms, this.uniforms);

	output.drawTo(function(){
		input.bind(0);
		shader.toViewport( uniforms );
	});
}

Tonemapper.prototype.injectCode = function( base_class )
{
    var fs_code = `

        precision highp float;
        varying vec2 v_coord;
        uniform float u_exposure;
        uniform float u_offset;
        uniform sampler2D u_color_texture;

        ` + base_class.Uniforms + `

        float C_GAMMA = 2.2;

        void main() {

            vec3 color = texture2D(u_color_texture, v_coord).rgb;

            color *= pow( 2.0, u_exposure );
            color += vec3(u_offset);

            ` + base_class.Code + `

            #ifdef GAMMA
                C_GAMMA = GAMMA;
            #endif

            color = pow(color, vec3(1.0/C_GAMMA));

            gl_FragColor = vec4(color, 1.0);
        }

    `;

    return fs_code;
}