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
	this.animations = ["No animation", "Running"];
    this.animation_name = this.animations[ this.animations.length < 3 ? 1 : 0 ];
	this.speed = 1;
}

Animator.icon = "https://webglstudio.org/latest/imgs/mini-icon-stickman.png";

Object.assign( Animator.prototype, {

	setup() {
		
		if( this.animation_name !== "No animation" ) {
			this.requestAnimation( this.animation_name );
		}

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

		widgets.addCheckbox("Enabled", this.enabled, { callback: v => { 
			this.enabled = v; 
        } });

        widgets.addCombo("Animation", this.animation_name, { values: this.animations, callback: v => { 

            this.animation_name = v; 
            
            if(v == "No animation") {
                this.node.uniforms["u_Skinning"] = false;
                this.anim = new SkeletalAnimation();
                return;
            }

            this.requestAnimation( this.animation_name );
		} });

		widgets.addSeparator();

		var add_component_node = widgets.addButton(null, "&#10008; Delete component", {callback: () => {
			
            delete this.node.components["Animator"];
            this.node.uniforms["u_Skinning"] = false;
			gui.updateSidePanel(null, this.node.name);

		}});
		add_component_node.querySelector("button").classList.add("section-button");
	},

	requestAnimation( name ) {

		HttpRequest("data/animations/" + name.toLowerCase() + ".skanim", null, data => {
			this.anim.fromData(data);
			this.node.uniforms["u_Skinning"] = true;
		});
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