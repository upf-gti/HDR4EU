// @jxarco
// GTI 2022

class ShaderEditorModule {

    constructor() {

        this.tabSpaces = 4;
        this.plain_text = null;

		this.inspector = new LiteGUI.Inspector();
        this.fromfile = null;

        this.vs_code = {
            active: true,
            string: ""
        };

        this.fs_code = {
            active: false,
            string: ""
        };

        this.editor = null;
    }

    getLine ( text, idx) {
		
        if(idx > text.length)
        return -1;
    
        var s = "";
    
        for (var i = 0; i < idx; i++) {
            if (text[i] === '\n')
                s = "";
            else
            s += text[i];
        }
      
        return s;
    }
    
    getTabs(text, n) {
        var count = 0;
        var spaces = 0;
    
        for (var i = 0; i < text.length; i++) {
            if (text[i] === ' '){
                spaces++;
    
                if(spaces == n){
                    count++;
                    spaces = 0;
                }
            }
            else
                spaces = 0;
        }
    
        return count;
    }

    makeSpaces(spaces) {
        var string = "";
        for(var i = 0; i < this.tabSpaces * (spaces != undefined ? spaces : 1); i++)
        string += " ";
        return string;
    }

    validate(data, callback) {

        if(window.node)
            window.node.shader = this.name; 

        if(callback)
            callback(this.name, data);
    }

    updateShader() {
        
        if(this.vs_code.active)
            this.vs_code.string = this.editor.getValue();
        else
            this.fs_code.string = this.editor.getValue();    
    }

    fromShader(name) {

        this.name = name;
        this.vs_code.string = gl.shaders[name]._vs;
        this.fs_code.string = gl.shaders[name]._fs;

        // it will be enabled?
        setTimeout((function(){
            this.editor.focus();
            this.editor.setValue(this.vs_code.string);
        }).bind(this), 10);
    }

    compile() {

        var name = this.name;

        this.updateShader();

        if(this.output_area.value.length)
        {
            this.output_area.value += "\n";
            this.output_area.scrollTop = this.output_area.scrollHeight;
        }

        var shader = gl.shaders[ name ];
        var macros = RM.shader_macros;
        var vs = this.vs_code.string;
        var fs = this.fs_code.string;
        var err = false;

        try {

            if( shader )
                shader.updateShader( vs, fs, macros );
            else {
                shader = new GL.Shader( vs, fs, macros );
                gl.shaders[ name ] = shader;
            }

        } catch (error) {
            err = true;
            this.output_area.value += error;
            this.output_area.scrollTop = this.output_area.scrollHeight;
            GL.Shader.dumpErrorToConsole(error,vs,fs);
        }

        gl.shaders[ name ]._vs = vs;
        gl.shaders[ name ]._fs = fs;

        if(!err) {
            this.output_area.value += "Compiled";
            this.validate();
        }
    }

    stringToError(text) {
        return "<span style='color:red'>" + text + "</span>";
    }

    openWindow(name, callback) {
        
        var that = this;
        this.plain_text = null;
        this.fromfile = null;

		var dialog = new LiteGUI.Dialog({ title: "Shader code" + (name ? ": " + name : ""), width: 780, closable: true, draggable: true });
        this.inspector_area = new LiteGUI.Area({id :"inspectorarea", content_id:"inspector-area", autoresize: true, inmediateResize: true});
        dialog.add( this.inspector_area );
        this.inspector_area.split("horizontal",[64,null], false);

        this.tabs = new LiteGUI.Tabs( { id: "shader_tabs", width: "full", mode: "vertical", autoswitch: true });
        this.tabs.addTab( "VS", {id:"vs_tab", bigicon: "https://webglstudio.org/latest/imgs/tabicon-scene.png", size: "full", content:"",
            callback: function(tab_id){
                if(!that.inputArea)
                return;
                that.editor.setValue(that.vs_code.string);
                that.vs_code.active = true;
            },
            callback_leave: function(tab_id) {
                if(!that.inputArea)
                return;
               that.vs_code.string = that.editor.getValue();
               that.vs_code.active = false;
            }
        });

        this.tabs.addTab( "FS", {id:"fs_tab", bigicon: "https://webglstudio.org/latest/imgs/tabicon-shaders.png", size: "full", content:"",
            callback: function(tab_id){
                if(!that.inputArea)
                return;
                that.editor.setValue(that.fs_code.string);
                that.fs_code.active = true;
            },
            callback_leave: function(tab_id) {
                if(!that.inputArea)
                return;
                that.fs_code.string = that.editor.getValue();
                that.fs_code.active = false;
            }
        });

        this.inspector_area.getSection(0).add( this.tabs );
       
        this.inspector.on_refresh = (function() {

            this.inspector.clear();
            this.inspector.widgets_per_row = 1;
            var text_area = this.inspector.addTextarea(null, this.plain_text || "",{height: "400px", callback: function(v){
                that.plain_text = v;
            }});
            var text_box = text_area.querySelector(".inputfield");
            this.inputArea = text_box.querySelector("textarea");

            this.editor = CodeMirror.fromTextArea(this.inputArea, {
				mode:  "glsl",
				theme: "moxer",
				lineWrapping: true,
                gutter: true,
				tabSize: 4,
				lineNumbers: true,
				matchBrackets: true,
				styleActiveLine: true,
				extraKeys: {
					"Ctrl-Enter": "assign"
				}
            });

            if(!name)
            {
                name = this.name = "unnamed";
            }
            // load shader
            else
            {
                this.fromShader(name);
            }

            // this.editor.on('keyHandled', function(e) {
            //     that.processInput(this, e, that);
            // });

            this.editor.refresh();
            text_box.querySelector(".CodeMirror-wrap").style.height = "400px";

            var output = this.inspector.addTextarea(null, "", {height: "75px", disabled: true});
            var text_box_output = output.querySelector(".inputfield");
            text_box_output.classList.add("console-text");
            this.output_area = text_box_output.querySelector("textarea");

            this.inspector.widgets_per_row = 2;
            this.inspector.addString("Name", this.name, {placeHolder: this.name, callback: function(v){
                that.name = v;
            }})
    
            this.inspector.addButton(null, "Compile", function(){
                that.compile();
            });

            this.inspector.widgets_per_row = 1;
            this.inspector.addSeparator();
            this.inspector_area.getSection(1).add( this.inspector );
            dialog.adjustSize(2);
            dialog.show();

        }).bind(this);

        this.inspector.on_refresh();
    }

    processInput(area, e, module)
    {
        var start = area.selectionStart;
        var end = area.selectionEnd;

        var tabSpaces = module.tabSpaces;
        var line = module.getLine(area.value, start);
        var numTabs = module.getTabs(line, 4);

        if (e.key == 'Tab') {
            e.preventDefault();
            // Soportar más casos de espacios/tabs
            if(e.shiftKey) {
                if(start == end && area.value.substring(start - tabSpaces, start) == module.makeSpaces()) {
                    area.value = area.value.substring(0, start - tabSpaces) + area.value.substring(end);
                    area.selectionStart = area.selectionEnd = start - tabSpaces;
                }
            }else {
                area.value = area.value.substring(0, start) + module.makeSpaces() + area.value.substring(end);
                area.selectionStart = area.selectionEnd = start + tabSpaces;
            } 
        }
        else if (e.key == 'Enter') {

            if(e.ctrlKey) {
                module.compile();
                return;
            }

            if(start != end)
            return false;

            e.preventDefault();

            if(area.value.substring(start - 1, start) == "{") {
                area.value = area.value.substring(0, start) + "\n" + module.makeSpaces(numTabs + 1) + "\n" + module.makeSpaces(numTabs) + area.value.substring(end);
                area.selectionStart = area.selectionEnd = start + tabSpaces * (numTabs + 1) + 1;
            }else
            {
                area.value = area.value.substring(0, start) + "\n" + module.makeSpaces(numTabs) + area.value.substring(end);
                area.selectionStart = area.selectionEnd = start + tabSpaces * (numTabs) + 1;
            }
        }else if (e.key == '"') {
            if(start == end && area.value.substring(start - 1, start) != '"' && area.value.substring(start, start + 1) == '\n'){
                area.value = area.value.substring(0, start) + '"' + area.value.substring(end);
                area.selectionStart = area.selectionEnd = start;
            }
        }else if (e.key == '{') {
            if(start == end) {
                area.value = area.value.substring(0, start) + '}' + area.value.substring(end);
                area.selectionStart = area.selectionEnd = start;
            }
        }

        return false;
    }
}

window.ShaderEditor = new ShaderEditorModule();