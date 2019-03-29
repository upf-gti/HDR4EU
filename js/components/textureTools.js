/*
*   Alex Rodriguez
*   @jxarco 
*/

function TextureTools()
{
	this.scale = 1;
	this.diffA = "";
	this.diffB = "";
}

Object.assign( TextureTools.prototype, {

	setup() {
		
		console.log(RM);
	},

	create(widgets, root) {
		
		var that = this;
		window.tmp_original_env = CORE._environment;

		widgets.on_refresh = function(){

			widgets.clear();

			that.diffA = CORE._environment;
			that.diffB = CORE._last_environment;

			const textures = Object.keys(gl.textures).filter( e => gl.textures[e].texture_type === GL.TEXTURE_CUBE_MAP && !e.includes("prem") );

			// TODO: select A and B 
			widgets.addTitle("Texture Difference");
			widgets.addCombo("A", that.diffA, { values: textures, callback: function(v){ that.diffA = v; } });
			widgets.addCombo("B", that.diffA, { values: textures, callback: function(v){ that.diffB = v; } });
			/*widgets.addString("Tex A", that.diffA, { callback: function(v){ that.diffA = v; } });
			widgets.addString("Tex B", that.diffB, { callback: function(v){ that.diffB = v; } });*/
			widgets.addSlider("Scale", that.scale, { min: 1, max: 10, step: 0.1,callback: function(v){ that.scale = v; } });
			widgets.widgets_per_row = 2;
			widgets.addButton(null, "Reset", { callback: function(v){ 
				
					CORE._environment = window.tmp_original_env;
					CORE.cubemap.textures["color"] = CORE._environment;
			} });
			widgets.addButton(null, "Update", { callback: function(v){ 
				
					widgets.on_refresh();
					if( getDiffTexture( that.diffA, that.diffB, that ) );
						CORE.cubemap.textures["color"] = "diffTex";
			} });
			widgets.widgets_per_row = 1;
		}

		widgets.on_refresh();
	}
});
		
RM.registerComponent( TextureTools, 'TextureTools');