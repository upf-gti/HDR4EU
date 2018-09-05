/*
*   Alex Rodríguez
*   @jxarco 
*/

var assets_folder = "../assets/";

function parseSceneFigure( name )
{
    showLoading();

    // remove previous matrix
    removeByName( 'matrix_node' );
    removeByName( 'roughness_scale_node' );
    removeByName( 'metalness_scale_node' );

    var toParse = scenes[name],
        current_figure = toParse;

    showMessage("Shaded model: " + name);
    params_gui['Mesh'] = name;
    gui.updateDisplay();

    // model has to be seen?
    model.flags.visible = toParse.useModel || false;

    // update camera by default
    camera.lookAt( toParse.camera.eye, toParse.camera.target, toParse.camera.up );

    if(name === "Sphere") {
        gui.f2.open();
         // set configuration
         model.mesh = toParse.mesh;
         model.shader = toParse.shader;
        removeLoading();
        return;
    }
        
    gui.f2.close();  // close sphere GUI 

    if(name === "Matrix") drawSphereMatrix( current_em );
    else if(name === "Roughness scale") drawRoughnessScale( current_em );
    else if(name === "Metalness scale") drawMetalnessScale( current_em );
    else
        renderer.loadMesh(toParse.mesh, function(res){

            // set configuration
            model.mesh = toParse.mesh;
            model.shader = toParse.shader;
           // model.flags.visible = false;

            let bb = gl.meshes[toParse.mesh].getBoundingBox();

            // update target from bb
            camera.lookAt( toParse.camera.eye, [bb[0], bb[1], bb[2]], toParse.camera.up );

            if( toParse.uniforms )
            {
                // model._uniforms["u_albedo"] = toParse.uniforms["u_albedo"];
                model._uniforms["u_roughness"] = toParse.uniforms["u_roughness"];
                model._uniforms["u_metalness"] = toParse.uniforms["u_metalness"];
            }

            // update node uniforms
            if(toParse.shader == "pbr")
            {
                model.textures['roughness'] = assets_folder + name +"/roughness.png";
                model.textures['metalness'] = assets_folder + name +"/metalness.png";
                model.textures['albedo'] = assets_folder + name +"/albedo.png";
                model.textures['normal'] = assets_folder + name +"/normal.png";
                model.textures['ao'] = assets_folder + name +"/ao.png";

                if(toParse.hasOpacity)
                {
                    model._uniforms["u_hasAlpha"] = true;
                    model.textures['opacity'] = assets_folder + name +"/opacity.png";
                }
                else
                {
                    model._uniforms["u_hasAlpha"] = false;
                    delete model.textures['opacity'];
                }

                if(toParse.isEmissive)
                {
                    model._uniforms["u_isEmissive"] = true;
                    model.textures['emissive'] = assets_folder + name +"/emissive.png";
                }
                else
                {
                    model._uniforms["u_isEmissive"] = false;
                    delete model.textures['emissive'];
                }
            }
            removeLoading();
        });
}

function setScene( filename, to_cubemap )
{
    var tex_name = getTexName( filename );
    current_em = tex_name;

    showLoading();

    var f = function()
    {
        // load all prefiltered EMS
        if(renderer.textures[current_em])
            updateNodeTextures(current_em);

        // config scene
        skybox.texture = current_em;
        skybox.flags.visible = true;
        // model.shader = "pbr";

        // wait 200 ms to show "finish! " message
        setTimeout(function(){
            params_gui['Scene'] = findTexPath(filename) || tex_name;
            gui.updateDisplay();
            gui.domElement.style.display = "block";
            removeLoading();
            showMessage("Rendering with " + default_shader_macros.N_SAMPLES + " samples");
        }, 200);
    }

    // not prefiltered tex
    if(!renderer.textures[ "_prem_0_" + current_em ])
        PREFILTER_EM( filename, {to_cubemap: to_cubemap, callback: f} );
    else
        f();
    
}

function updateNodeTextures(em)
{
    let nodes = [];

    nodes.push(model);
    nodes.push(getNodeByName('matrix_node'));
    nodes.push(getNodeByName('roughness_scale_node'));
    nodes.push(getNodeByName('metalness_scale_node'));

    for (var i = 0; i < nodes.length; i++)
    {
        let node = nodes[i];

        if(!node)
            continue;

        node.textures['env'] = em;
        node.textures['env_1'] = "_prem_0_" + em;
        node.textures['env_2'] = "_prem_1_" + em;
        node.textures['env_3'] = "_prem_2_" + em;
        node.textures['env_4'] = "_prem_3_" + em;
        node.textures['env_5'] = "_prem_4_" + em;

        if(!node.children.length)
            continue;

        for (var j = 0; j < node.children.length;  j++)
        {
            let child = node.children[j];

            child.textures['env'] = em;
            child.textures['env_1'] = "_prem_0_" + em;
            child.textures['env_2'] = "_prem_1_" + em;
            child.textures['env_3'] = "_prem_2_" + em;
            child.textures['env_4'] = "_prem_3_" + em;
            child.textures['env_5'] = "_prem_4_" + em;
        }
    }
}



function setSkybox( scene )
{
    var skybox = new RD.SceneNode();
    skybox.name = "Skybox";
    skybox.mesh = "cube";
    skybox.shader = "skyboxExpo";
    skybox.flags.depth_test = false;
    skybox.flags.flip_normals = true;
    skybox.flags.visible = false;
    mat4.invert($temp.mat4, camera._viewprojection_matrix);
    skybox._uniforms['u_inv_viewprojection_matrix'] = $temp.mat4;
    skybox.render_priority = RD.PRIORITY_BACKGROUND;
    scene.root.addChild( skybox );
    return skybox;
}

function getNodeByName( name )
{
    for(var i = 0; i < scene.root.children.length; i++)
    {
        if(scene.root.children[i].name == name)
            return scene.root.children[i];
    }

    return null;
}

function removeByName( name )
{
    for(var i = 0; i < scene.root.children.length; i++)
    {
        if(scene.root.children[i].name == name)
            scene.root.children[i].destroy();
    }
}

function findTexPath(fn)
{ 
    for(t in textures)
        if(textures[t].path == fn)
            return t;
    return null;
}

function drawSphereMatrix( em, visible )
{
    // remove previous
    removeByName( 'matrix_node' );
    var values = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

    var node = new RD.SceneNode();
    node.name = "matrix_node";
    node.flags.visible = visible;
    scene.root.addChild(node);

    for(var i = 0; i < 10; i++)
    {
        for(var j = 0; j < 10; j++)
        {
            var mn = new RD.SceneNode();
            mn.mesh = "sphere";
            mn.shader = "pbrMat";
            mn.position = [j*2,0,i*2];
            // mn._uniforms["u_albedo"] = vec3.fromValues( params_gui['Albedo'][0]/255.0, params_gui['Albedo'][1]/255.0,params_gui['Albedo'][2]/255.0);
            mn._uniforms["u_roughness"] = values[i];
            mn._uniforms["u_metalness"] = values[j];
            mn.textures['brdf'] = "_brdf_integrator";
            mn.textures['env'] = em;
            mn.textures['env_1'] = "_prem_0_"+em;
            mn.textures['env_2'] = "_prem_1_"+em;
            mn.textures['env_3'] = "_prem_2_"+em;
            mn.textures['env_4'] = "_prem_3_"+em;
            mn.textures['env_5'] = "_prem_4_"+em;
            node.addChild(mn);
        }
    }

    removeLoading();
}

function drawRoughnessScale( em, visible, metalness )
{
    // remove previous
    removeByName( 'roughness_scale_node' );
    var values = [1.0, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125, 0.0];

    var node = new RD.SceneNode();
    node.name = "roughness_scale_node";
    node.flags.visible = visible;
    scene.root.addChild(node);

    for(var i = 0; i < 9; i++)
    {
        var mn = new RD.SceneNode();
        mn.mesh = "sphere";
        mn.position = [0,0,i*2];
        // mn._uniforms["u_albedo"] = vec3.fromValues( params_gui['Albedo'][0]/255.0, params_gui['Albedo'][1]/255.0,params_gui['Albedo'][2]/255.0);
        mn._uniforms["u_roughness"] = values[i];
        mn._uniforms["u_metalness"] = metalness != null ? metalness : 1.0;
        mn.textures['brdf'] = "_brdf_integrator";
        mn.textures['env'] = em;
        mn.textures['env_1'] = "_prem_0_"+em;
        mn.textures['env_2'] = "_prem_1_"+em;
        mn.textures['env_3'] = "_prem_2_"+em;
        mn.textures['env_4'] = "_prem_3_"+em;
        mn.textures['env_5'] = "_prem_4_"+em;
        mn.shader = "pbrMat";
        node.addChild( mn );
    }

    removeLoading();
}

function drawMetalnessScale( em, visible, roughness )
{
    // remove previous
    removeByName( 'metalness_scale_node' );
    var values = [1.0, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125, 0.0];

    var node = new RD.SceneNode();
    node.name = "metalness_scale_node";
    node.flags.visible = visible;
    scene.root.addChild(node);

    for(var i = 0; i < 9; i++)
    {
        var mn = new RD.SceneNode();
        mn.mesh = "sphere";
        mn.position = [0,0,i*2];
       //  mn._uniforms["u_albedo"] = vec3.fromValues( params_gui['Albedo'][0]/255.0, params_gui['Albedo'][1]/255.0,params_gui['Albedo'][2]/255.0);
        mn._uniforms["u_roughness"] = roughness != null ? roughness : 1.0;
        mn._uniforms["u_metalness"] = values[i];
        mn.textures['brdf'] = "_brdf_integrator";
        mn.textures['env'] = em;
        mn.textures['env_1'] = "_prem_0_"+em;
        mn.textures['env_2'] = "_prem_1_"+em;
        mn.textures['env_3'] = "_prem_2_"+em;
        mn.textures['env_4'] = "_prem_3_"+em;
        mn.textures['env_5'] = "_prem_4_"+em;
        mn.shader = "pbrMat";
        node.addChild( mn );
    }

    removeLoading();
}

