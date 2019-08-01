/*
*   Alex Rodriguez
*   @jxarco 
*/

function Light()
{
    if(this.constructor !== Light)
        throw("Use new");
    
    this.node = null;
    this.lights = [];
    this.position = vec3.fromValues(1, 5, 1);
    this.color = [1, 1, 1];
    this.intensity = 0;
	this.collapsed = false;
}

Object.defineProperty(Light.prototype, 'color', {
    get: function() { return this._color; },
    set: function(v) { 
        this._color = v; 
        if(CORE)
            CORE.setUniform('light_color', v);
        if(this.node){
            var i = this.intensity;
            this.node.color = [v[0]*i, v[1]*i, v[2]*i];
        }
    }, enumerable: true    
});

Object.defineProperty(Light.prototype, 'position', {
    get: function() { return this._position; },
    set: function(v) { 
        this._position = v; 
        if(CORE)
            CORE.setUniform('light_position', v); 
        if(this.node){
            this.node.position = v;
        }
    }, enumerable: true
});

Object.defineProperty(Light.prototype, 'intensity', {
    get: function() { return this._intensity; },
    set: function(v) { 
        this._intensity = v;
        if(CORE)
            CORE.setUniform('light_intensity', v);
        if(this.node){
            var color = this.color;
            this.node.color = [color[0]*v, color[1]*v, color[2]*v];
        }
    }, enumerable: true
});

Object.assign( Light.prototype, {
    
    toJSON() {
			
			var component = {};
			Object.assign(component, this);

			// delete node (cyclic)
			delete component.node;

			return component;
	},

	create(widgets) {

        var that = this;

		var element = widgets.addSection("Light", {collapsed: that.collapsed, callback: function(no_collapsed){
				that.collapsed = !no_collapsed;
			}});
			
		element.addEventListener("dragstart", function(e){
				e.dataTransfer.setData("type", "gui");
				e.dataTransfer.setData("component", "Light");
		});

		element.setAttribute("draggable", true);

        widgets.addVector3("Position", this.position, { callback: function(v){ that.position = v }});
		 widgets.widgets_per_row = 2;
        widgets.addNumber("Size", this.node.scaling[0], {step: 0.01, callback: function(v){ that.node.scaling = v }});
		widgets.addCheckbox("Show node", this.node.visible, {callback: function(v){ that.node.visible = v }});
		widgets.widgets_per_row = 1;
        widgets.addColor("Color", this.color, {callback: function(color){ 
            that.color = color;
        }});
        widgets.addSlider("Intensity", this.intensity, {min:0,max:50,step:0.1,callback: function(v) {  
            that.intensity = v; 
        }});
    }
} );

RM.registerComponent( Light, 'Light');