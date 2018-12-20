
/*
	List of components to use in the app
	global components or gui components
*/

function Tonemapper()
{
    if(this.constructor !== Tonemapper)
        throw("Use new");

    this.uniforms = {};
}

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

Tonemapper.prototype.setParam = function ( name, value )
{
	
	this.params[name].value = value;

}

// *****************************************************************************
//				bon nadal
// *****************************************************************************


function Light()
{
    if(this.constructor !== Light)
        throw("Use new");
	

	this.position = vec3.fromValues(1, 5, 1);
	this.color = [1, 1, 1];
	this.intensity = 0;
}

CORE.registerComponent( Light, 'Light');

function NodePicker()
{
    if(this.constructor !== NodePicker)
        throw("Use new");
	
}

CORE.registerComponent( NodePicker, 'NodePicker');

/*
	GUI components
*/


function SFX()
{
    if(this.constructor !== SFX)
        throw("Use new");
	
	this.exposure = 0;
	this.offset= 0;

	this.glow_enable = false;
	this.glow_intensity = 1;
	this.glow_threshold = 25;
	this.glow_iterations = 8;

	this.fxaa = true;

	this.tonemapping = "Reinhard";
    
}

CORE.registerComponent( SFX, 'Screen FX');

