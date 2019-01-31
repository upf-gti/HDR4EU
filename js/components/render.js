/*
*   Alex Rodriguez
*   @jxarco 
*/

function Render()
{
	if(this.constructor !== Render)
		throw("Use new");
	
	this.render_mode = RM.FORWARD;
	this.show_more = false;
}

Object.assign( Render.prototype, {

	create(widgets, root) {
		var that = this;
	
		widgets.addSection("Render");
		widgets.addTitle('IBL');
		widgets.addSlider("Scale", renderer._uniforms["u_ibl_intensity"], {min:0.0, max: 10,name_width: '50%', callback: function(v){ CORE.setUniform('ibl_intensity', v); }});
		widgets.widgets_per_row = 3;
		widgets.addButton(null,  this.show_more ? "Show less" : "Show more", {name_width: '50%', callback: function(){ 
			that.show_more = !that.show_more;
			window.last_scroll = root.content.getElementsByClassName("inspector")[0].scrollTop;
			gui.updateSidePanel( that._sidepanel, 'root' ); 
		}});
		widgets.widgets_per_row = 2;
		if(this.show_more) {
			widgets.addSeparator();
			widgets.addCheckbox("Correct Albedo",  renderer._uniforms["u_correctAlbedo"], {name_width: '50%', callback: function(v){  CORE.setUniform('correctAlbedo', v); }});
			widgets.addCheckbox("Baked A0",  renderer._uniforms['u_enable_ao'], {name_width: '50%', callback: function(v){  CORE.setUniform('enable_ao', v); }});
		}
		widgets.addSeparator();
		widgets.widgets_per_row = 1;
	
		widgets.addCombo("Render mode", this.render_mode, {values: [RM.FORWARD, RM.DEFERRED], name_width: '50%', callback: function(v) { 
			that.render_mode = v; 
			window.last_scroll = root.content.getElementsByClassName("inspector")[0].scrollTop;
			gui.updateSidePanel( that._sidepanel, 'root' ); 
		}});
	
		if(this.render_mode == RM.FORWARD) {
			
		}
		else {
			widgets.addTitle('SSAO');
			widgets.addCheckbox("Enable", true, {name_width: '50%', callback: function(v){ CORE.setUniform('enableSSAO', v); }});
			widgets.addSlider("Kernel radius", renderer._uniforms['u_radius'], {min:1,max:32,step:0.1,name_width: '50%', callback: function(v) { CORE.setUniform('radius', v); }});
			/*widgets.addCombo("Noise tiling", 4, {values: [4, 8, 16, 32, 64, 128, 256], name_width: '50%', callback: function(v) { 
				CORE.setUniform('noise_tiling', v);
			}});*/
			widgets.addCombo("Output", 'Default', {values: ['Default', 'SSAO only', 'Depth', 'Normal'], name_width: '50%', callback: function(v) { 
				var values = $(this)[0].options.values;
				CORE.setUniform('outputChannel', parseFloat(values.indexOf(v)));
			}});
			//widgets.widgets_per_row = 2;
			//widgets.addNumber("Min distance", 0.001.glow_threshold, {min:0.001,max:0.05,step:0.001,callback: function(v) {  }});
			//widgets.addNumber("Max distance", 0.01, {min:0.01,max:0.5,step:0.01,callback: function(v) {  }});
		}
		
		widgets.widgets_per_row = 1;
	}
} );

RM.registerComponent( Render, 'Render');