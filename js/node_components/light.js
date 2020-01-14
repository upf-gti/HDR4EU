/*
*   Alex Rodriguez
*   @jxarco 
*/

function Light(node)
{
    if(this.constructor !== Light)
        throw("Use new");

    if(node.parentNode.hasLight) {
        LiteGUI.alert("Error (Only one light supported)");
        return;
    }
    
    this.node = node;
    this.color = [1, 1, 1];
    this.intensity = 1;
    this.collapsed = false;
    this.mark = true;

    // root has one light
    node.parentNode.hasLight = true;
}

Light.icon = "https://webglstudio.org/latest/imgs/mini-icon-light.png";

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
    
    setup() {
		
		console.log(RM);

		this.node.old_shader = this.node.shader;
        this.node.shader = "flat";
        
        CORE.setUniform('light_intensity', this.intensity);
        CORE.setUniform('light_color', this.color);
        CORE.setUniform('light_position', this.node.position);
    },

    remove() {

        this.node.parentNode.hasLight = false;

        this.intensity = 0;
        this.color = RD.WHITE;
    },
    
	create(widgets, root) {

        var that = this;

		var element = widgets.addSection("Light", {collapsed: that.collapsed, callback: function(no_collapsed){
				that.collapsed = !no_collapsed;
			}});
			
		element.addEventListener("dragstart", function(e){
				e.dataTransfer.setData("type", "gui");
				e.dataTransfer.setData("component", "Light");
		});

		element.setAttribute("draggable", true);

		widgets.addCheckbox("Show node", this.node.visible, {callback: function(v){ that.node.visible = v }});
        
        widgets.addSeparator();
        widgets.addInfo(null, "Light position is the same as the node position")
        widgets.addVector3("Position", this.node.position, {callback: function(v){
            that.node.position = v;
        }})
        widgets.addSeparator();
        widgets.addColor("Color", this.color, {callback: function(v){ 
            that.color = v;
        }});
        widgets.addSlider("Intensity", this.intensity, {min:0,max:50,step:0.1,callback: function(v) {  
            that.intensity = v; 
        }});

        widgets.addSeparator();

        var add_component_node = widgets.addButton(null, "&#10008; Delete component", {callback: function(){
			
			if(that.node.old_shader)
				that.node.shader = that.node.old_shader;

            that.remove();

			delete that.node.components["Light"];
			gui.updateSidePanel(null, that.node.name);

		}});
		add_component_node.querySelector("button").classList.add("section-button");
    }
} );

RM.registerNodeComponent( Light, 'Light');