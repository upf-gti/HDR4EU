
class FileSystem{
    
    constructor(callback)
    {
        this.lfs = LFS.setup("https://webglstudio.org/users/hermann/files/sauce_dev/src/", this.onReady.bind(this, callback) );
        this.session = null;
        this.parsers = {};
		this.root = "https://webglstudio.org/users/hermann/files/sauce_dev/files/";
    }

   
    init(){
      console.log(this);
    }

    onFileDrop( files ){
        
        console.log(files);
        for(var i = 0; i < files.items.length; i++){

            let fileReader = new FileReader(),
            file = files.items[i].getAsFile(),
            ext = (file.name).substr((file.name).lastIndexOf(".")+1),
            folder = "others";

            this.uploadFile("hdre", files.items[i], ["hdre"]);
        }

    }

    onReady(callback){
        LFS.login( "admin", "foo", this.onLogin.bind(this, callback) );
    }

    onLogin( callback, session ){
        if(!session)
            throw("error in login");
        this.session = session;

        if(callback)
        callback();
    }

    async getTags( folder, session ){

        return new Promise( (resolve, reject)=>{

            var session = this.session;

            session.request(
                session.server_url, 
                { action: "tags/getTags"}, e=>{
                console.log(e);
                resolve(e);
            }, reject, e => {});
        });
    }
    
    async uploadFile(folder, file, metadata){


        return new Promise((resolve, reject) => {

            let path = "8efb30d54aee665af72c445acf53284b/"+folder+"/"+ file.name;
            var session = this.session;

			session.uploadFile( path, file, 
                    { "metadata": metadata }, 
                    function(e){console.log("complete",e); resolve()},
                    e => console.log("error",e)); //,
//                    e => console.log("progress",e));
        });
    }

    async uploadData(folder, data, filename, metadata){


        return new Promise((resolve, reject) => {

            let path = "8efb30d54aee665af72c445acf53284b/"+folder+"/"+ filename;
            var session = this.session;

			session.uploadFile( path, data, 
                    { "metadata": metadata }, 
                    function(e){console.log("complete",e); resolve()},
                    e => console.log("error",e)); //,
//                    e => console.log("progress",e));
        });
    }

    async getFiles( folder ){
        return new Promise( (resolve, reject)=>{
        
            function onError(e){
                reject(e);
            }
    
            function onFiles(f){
                if(!f)
                    return onError("Error: folder \""+folder+"\" not found.");
                resolve(f);
            }

            var session = this.session;

            session.request( 
                session.server_url,
                { action: "tags/getFilesInFolder", unit: "HDR4EU", folder: folder }, function(resp){

                if(resp.status < 1){
                    onError(resp.msg);
                    return;
                }
                //resp.data = JSON.parse(resp.data);
                LiteFileServer.Session.processFileList( resp.data, "HDR4EU" + "/" + folder );

                onFiles(resp.data, resp);
            });


        });
    }

    
}
