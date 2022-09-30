/*
*   Alex Rodriguez
*   @jxarco 
*/

function Animator(node)
{
	this.node = node;
	this.mark = true;
	this.collapsed = false;
	this.nodeComponent = true;

    this.enabled = true;
    this.anim = new SkeletalAnimation();
    this.animation_name = "";
	this.speed = 1;
}

Animator.icon = "https://webglstudio.org/latest/imgs/mini-icon-stickman.png";

Object.assign( Animator.prototype, {

	setup() {
		
        console.log(RM);
	},

	create(widgets, no_section) {
		
		var that = this;

        if(!no_section || no_section.constructor === LiteGUI.Panel)
		{
			var element = widgets.addSection("Animator", {collapsed: that.collapsed, callback: function(no_collapsed){
				that.collapsed = !no_collapsed;
			}});
		
			element.addEventListener("dragstart", function(e){
					e.dataTransfer.setData("type", "gui");
					e.dataTransfer.setData("component", "Animator");
			});
	
			element.setAttribute("draggable", true);
		}

		widgets.addCheckbox("Enabled", this.enabled, { callback: function(v){ 
			that.enabled = v; 
        } });

        var values = ["", "Running"];

        widgets.addCombo("Animation", this.animation_name, { values: values, callback: function(v){ 
            that.animation_name = v; 
            
            if(v == "") {
                that.node.uniforms["u_Skinning"] = false;
                that.anim = new SkeletalAnimation();
                return;
            }

            HttpRequest("data/animations/" + v.toLowerCase() + ".skanim", null, function(data) {
                that.anim.fromData(data);
                that.node.uniforms["u_Skinning"] = true;
            });
		} });

		widgets.addSeparator();

		var add_component_node = widgets.addButton(null, "&#10008; Delete component", {callback: function(){
			
            delete that.node.components["Animator"];
            that.node.uniforms["u_Skinning"] = false;
			gui.updateSidePanel(null, that.node.name);

		}});
		add_component_node.querySelector("button").classList.add("section-button");
	},

	preUpdate() {
		
		if(!this.enabled || !this.animation_name.length)
        return;
        
        var time = getTime()*0.001;

        if(this.anim.duration)
            this.anim.assignTime( time );
        this.node.bones = this.anim.skeleton.computeFinalBoneMatrices( this.node.bones, gl.meshes[ this.node.mesh ] );
    
        if(this.node.bones && this.node.bones.length)
            this.node.uniforms.u_bones = this.node.bones;
	}
});

RM.registerNodeComponent( Animator, 'Animator');