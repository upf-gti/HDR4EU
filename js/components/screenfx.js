/*
*   Alex Rodriguez
*   @jxarco 
*/

function SFX()
{
	if(this.constructor !== SFX)
		throw("Use new");
	
	this._exposure = 0;
	this._offset= 0;

	this.glow_enable = false;
	this.glow_intensity = 1;
	this.glow_threshold = 25;
	this.glow_iterations = 8;

	this.fxaa = false;
	this.tonemapping = "Reinhard";
	
}

Object.defineProperty(SFX.prototype, 'exposure', {
	get: function() { return this._exposure; },
	set: function(v) { this._exposure = v; CORE.setUniform("exposure", v); },
	enumerable: true
});

Object.defineProperty(SFX.prototype, 'offset', {
	get: function() { return this._offset; },
	set: function(v) { this._offset = v; CORE.setUniform("offset", v); },
	enumerable: true
});

Object.assign( SFX.prototype, {

	create(widgets, root) {

		var that = this;
	
		widgets.addSection("FX");
		widgets.addTitle("Frame");
		widgets.addNumber("Exposure", this.exposure,{min:-10,max:10,step:0.1,callback: function(v) { that.exposure = v; }});
		widgets.addNumber("Offset", this.offset,{min:-0.5,max:0.5,step:0.01,callback: function(v) { that.offset = v; }});
		widgets.addCheckbox("FXAA",  this.fxaa, {name_width: '50%', callback: function(v){ that.fxaa = v; }});

		if(CORE.browser !== 'safari')
		{
			widgets.addTitle("Tonemapping");

			var tonemapper_names = Object.keys(RM.tonemappers);
			var name = this.tonemapping;
			var tonemapper = RM.tonemappers[ name ];

			widgets.addCombo(null, name, {values: tonemapper_names, callback: function(v){
				that.tonemapping = v;
				window.last_scroll = root.content.getElementsByClassName("inspector")[0].scrollTop;
				gui.updateSidePanel( that._sidepanel, 'root' );
			}});
			
			if(tonemapper && tonemapper.params)
				for( let p in tonemapper.params ) // important let!!
				{
					var tm = tonemapper.params[p];
					var options = tm.options || {};

					CORE.setUniform(p, tm.value); 

					/*var element = document.createElement('i');
					element.className = "material-icons dragIcon";
					element.innerHTML = "panorama_fish_eye";
					pretitle: element.outerHTML */
					
					var toDrag = widgets.addSlider(p, tm.value, {min:options.min || 0,max:options.max||1,step:options.step||0.1,name_width: '50%', callback: function(v) {  
						CORE.setUniform(p, v); 
						tonemapper.setParam(p, v);
					}});

					toDrag.addEventListener("dragstart", function( e )
					{  
						e.dataTransfer.setData("type", "text");
						e.dataTransfer.setData("uniform", p);
						var img = new Image(); 
						img.src = 'https://webglstudio.org/latest/imgs/mini-icon-text.png'; 
						e.dataTransfer.setDragImage(img, 10, 10);
					});
					toDrag.setAttribute("draggable", true);
				}
			widgets.addSeparator();
		}
		
		//widgets.widgets_per_row = 1;
		widgets.addTitle("Glow");
		widgets.widgets_per_row = 2;
		widgets.addCheckbox("Enable", this.glow_enable, {width:"35%",callback: function(v) { that.glow_enable = v; } });
		widgets.addSlider("Intensity", this.glow_intensity, {width:"65%",min:1,max:2,step:0.1,callback: function(v) {  that.glow_intensity = v; }});
		widgets.addNumber("Threshold", this.glow_threshold, {min:0,max:500000,step:0.1,callback: function(v) { that.glow_threshold = v; }});
		widgets.addCombo("Iterations", this.glow_iterations, {values: [4, 8, 16],callback: function(v) { that.glow_iterations = v; }});
		widgets.widgets_per_row = 1;
		widgets.addSeparator();
		widgets.addSeparator();
	}
} );

RM.registerComponent( SFX, 'ScreenFX');