/*
*   Alex Rodriguez
*   @jxarco 
*/

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