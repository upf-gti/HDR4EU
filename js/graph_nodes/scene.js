/*
*   Alex Rodriguez
*   @jxarco 
*/

function LGraphCamera()
{
	/*
	this.color = "#1B662D"
    this.bgcolor = "#384837";
	this.boxcolor = "#999";
    */
    this.addOutput("Position","vec3");
    this.addOutput("Near","number");
    this.addOutput("Far","number");
}

LGraphCamera.title = "Camera";

LGraphCamera.prototype.onExecute = function()
{
    var camera = CORE.controller.camera;

    if (!camera) {
        return;
    }

    this.setOutputData(0, camera.position );
    this.setOutputData(1, camera.near );
    this.setOutputData(2, camera.far );
}

LiteGraph.registerNodeType("scene/camera", LGraphCamera);

function LGraphUniforms()
{
    this.addOutput("u_logLumAvg","Number");
    this.addOutput("u_LumAvg","Number");
    this.properties = {};
}

LGraphUniforms.title = "Uniforms";
LGraphUniforms.desc = "Get any scene uniform";

LGraphUniforms.prototype.onExecute = function()
{
    if(!CORE)
    return;

    for(var i = 0; i < this.outputs.length; ++i){
        
        var slot_name = this.outputs[i].name;
        var slot = this.findOutputSlot(slot_name);
        this.setOutputData(slot, CORE.renderer._uniforms[slot_name] );
    }
}

LGraphUniforms.prototype.onGetOutputs = function()
{   
    if(!CORE)
    return;

    var outputs = [
        ["u_logLumAvg", "Number"],
        ["u_LumAvg", "Number"]
    ];

    for(var key in CORE.renderer._uniforms)
    {
        if(!CORE.renderer._uniforms[key]) continue;
        outputs.push( [key, CORE.renderer._uniforms[key].constructor.name] );
    }

    var filtered_outputs = [];

    for(var i in outputs)
    {
        var slot_name = outputs[i][0];
        if(this.findOutputSlot(slot_name) < 0)
            filtered_outputs.push( outputs[i] );
    }
    
    return filtered_outputs;
}

LiteGraph.registerNodeType("scene/uniforms", LGraphUniforms );

function LGraphPrem()
{
    this.addOutput("Level","Skybox");
	
	this.properties = {
		mipLevel: 0
	};
	
	var that = this;
	this.addWidget("combo", "Mip level", this.properties["mipLevel"], function(v){ 

		that.properties["mipLevel"] = v;

	}, {values:[0, 1, 2, 3, 4, 5]}, this.properties);
}

LGraphPrem.title = "Prefiltered environment";
LGraphPrem.desc = "Display PBR prefiltered levels";

LGraphPrem.prototype.onExecute = function()
{
	if(!CORE)
	return;
	
	var level = this.properties["mipLevel"];

	// original prem
	if(level == 0)
	{
		this.setOutputData(0, CORE._environment );
		return;
	}

	this.setOutputData(0, "@mip" + level + "__" + CORE._environment );
};

LiteGraph.registerNodeType("scene/prem", LGraphPrem);