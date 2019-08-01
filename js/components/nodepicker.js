/*
*   Alex Rodriguez
*   @jxarco 
*/

function NodePicker()
{
    if(this.constructor !== NodePicker)
        throw("Use new");
    
    this.selected = null;
}

Object.assign( NodePicker.prototype, {

    setup() {

    },

    select(node) {

        if(node.constructor !== RD.SceneNode)
        throw("bad param");
    
        this.selected = node;
        window.node = node;
    },

    delete() {

        if(!this.selected)
        return;

        if(this.selected.name === 'light') {

			var LightComponent = RM.get('Light');
			
            LightComponent.node = null;
			LightComponent.color = RD.WHITE;
			LightComponent.intensity = 0;
        }

        this.selected.destroy();
        this.selected = null;
        delete gl.meshes['lines'];

        for(var t in gl.textures)
            if(t.includes( this._last_environment ))
                delete gl.textures[t];

        setTimeout( function(){
        
            gui.updateSidePanel(null, "root");
        }, 10 );
    },

    render() {

        var node = this.selected;
        var root = CORE._root;

        if(!node)
        return;

        var bb = gl.meshes[node.mesh].bounding,
            globalMat = node.getGlobalMatrix();
            
        // Get points
        var corners = getBBCorners(bb);

        // Transform points
        for(var i = 0; i < corners.length; i++)
        {
            var res = vec3.create(),
                p = corners[i];

            vec3.transformMat4( res, p, globalMat );
            corners[i] = res;
        }

        // Create list for mesh
        var points = [];
        points.push(

                corners[0], corners[1],
                corners[1], corners[3],
                corners[3], corners[2],
                corners[2], corners[0],

                corners[4], corners[5],
                corners[5], corners[7],
                corners[7], corners[6],
                corners[6], corners[4],

                corners[0], corners[4],
                corners[1], corners[5],
                corners[2], corners[6],
                corners[3], corners[7]
        );

        var vertices = [];

        for(var i = 0; i < points.length; ++i)
                vertices.push(points[i][0], points[i][1], points[i][2]);

        if(!gl.meshes["lines"])
        {
            var mesh = GL.Mesh.load({ vertices: vertices });
            gl.meshes["lines"] = mesh;
            var l = new RD.SceneNode();
            l.flags.ignore_collisions = true;
            l.primitive = gl.LINES;
			l.layers = 4;
            l.mesh = "lines";
            l.name = "lines";
            l.color = [1,1,1,1];
            root.addChild(l);
        }
        else
        {
            var mesh = gl.meshes["lines"];
            mesh.getBuffer("vertices").data.set( vertices );
            mesh.getBuffer("vertices").upload( GL.STREAM_DRAW );
        }
    }
} );

RM.registerComponent( NodePicker, 'NodePicker');