import { Vector3, Color3, Engine, Scene, ArcRotateCamera, HemisphericLight, CreateGround, MeshBuilder, StandardMaterial, PointerEventTypes, Mesh, Nullable, Scalar, Quaternion, ShadowGenerator, DirectionalLight, ActionManager, ExecuteCodeAction, Ray, RayHelper, Axis, AssetsManager, ParticleSystem, Texture, SphereParticleEmitter } from "@babylonjs/core";
import './index.css';

export default class Game {
    engine: Engine;
    scene: Scene;
    camera;
    canvas: HTMLCanvasElement;
    player: Nullable<Mesh> = null;
    source = Quaternion.FromEulerAngles(0,0,0);
    target = Quaternion.FromEulerAngles(0,0,0);
    shadowGenerator:ShadowGenerator;
    //jumping and collision with ground checks
    velocity = new Vector3();
    dashvelv = new Vector3();
    dashvelh = new Vector3();

    //Input detection
    jumpKeyDown = false;
    isJumping = false;
    //inputs & keys
    inputMap = {};
    onObject = false;

    //dashes
    dashTime = 0;
    startDashTime = 0.1;
    dxn = 0; //which dxn dash should go
    dashing = false;

    //particle system
    ps:Nullable<ParticleSystem>;
    fireball:Mesh;
    bullet:Mesh = null;
    fireReady:boolean = false;
    fireStatus = false;
    fireRanger = 20;
    fireVelocity = 0.1;
    fireDirection:Vector3 =Vector3.Zero();
    distance = 0;
    fireStart:Vector3 = Vector3.Zero();

    constructor() {
        this.canvas = document.createElement("canvas");
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.id = "gameCanvas";
        document.body.appendChild(this.canvas);
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);
        this.camera = this.createCamera(this.scene);
       
        this.createEnvironment(this.scene);
        this.engine.runRenderLoop(
            () => {
                this.scene.render();
            }
        );
        
        this.registerPointerHandler();
        this.scene.onBeforeRenderObservable.add(() => {
            this._updateFrame();
            this._checkInput(this.scene);
        });
        this.registerAction(this.scene);
        this.registerUpdate(this.scene);

        this.gameObjects(this.scene);
        this._loadParticleSystem(this.scene);
    }

    private  _loadParticleSystem(scene:Scene)
    {
        var myParticleSystem = null;
        const assetsManager = new AssetsManager(scene);
        // const particleTexture = assetsManager.addTextureTask("my particle texture", "https://models.babylonjs.com/Demos/particles/textures/dotParticle.png")
        const particleFile = assetsManager.addTextFileTask("my particle system", "/particleSystem.json");
        
        // load all tasks
        assetsManager.load();
    
        // after all tasks done, set up particle system
        assetsManager.onFinish = (tasks) => {
            // console.log("tasks successful", tasks);
    
            // prepare to parse particle system files
            const particleJSON = JSON.parse(particleFile.text);
            myParticleSystem = ParticleSystem.Parse(particleJSON, scene, "");
    
            // set particle texture
            // myParticleSystem.particleTexture = particleTexture.texture;
    
            // set emitter
            // myParticleSystem.emitter = sphere;
            myParticleSystem.emitter = this.fireball;
            // myParticleSystem.particleEmitterType = new SphereParticleEmitter();
            this.ps = myParticleSystem;
            this.fireReady = true;
        }

    }

    private _checkInput(scene:Scene)
    {
        // dash implementation Blackthornprod unity tutorial
        // not dashing
        if(this.player)
        {
            // console.log("player forward：", this.player.forward);
            let keydown = false;
            let step = Vector3.Zero();
            if(!this.dashing) {
                if(this.inputMap["w"] || this.inputMap["ArrowUp"]){
                    step = this.player.right;
                    step.y = 0;
                    this.player.moveWithCollisions(step.scaleInPlace(0.1));
                    // this.player.position.z+=0.1;
                    keydown=true;
                    this.dxn = 1;
                } 
                if(this.inputMap["a"] || this.inputMap["ArrowLeft"]){
                    step  = this.player.forward;
                    step.y = 0;
                    this.player.moveWithCollisions(step.scaleInPlace(0.1));
                    keydown=true;
                    this.dxn = 3;
                } 
                if(this.inputMap["s"] || this.inputMap["ArrowDown"]){
                    step = this.player.right;
                    step.y = 0;
                    this.player.moveWithCollisions(step.scaleInPlace(-0.1));

                    keydown=true;
                } 
                if(this.inputMap["d"] || this.inputMap["ArrowRight"]){
                    step  = this.player.forward;
                    step.y = 0;
                    this.player.moveWithCollisions(step.scaleInPlace(-0.1));
                    keydown=true;
                    this.dxn = 4;
                }
                if(this.inputMap["Shift"] && this.dxn != 0){
                    keydown=true;
                    this.dashing = true;
                } else {
                    this.dxn = 0;
                }
                if(this.inputMap["f"])
                {
                    if(this.bullet)
                    {
                        if(!this.fireStatus)
                        {
                            this.fireStatus = true;
                            this.fireDirection.copyFrom(this.player.right);
                            // this.fireDirection = this.player.right;
                            // console.log("fire directon:",this.fireDirection);
                            this.distance = 0;
                            this.bullet.setParent(null);
                            this.fireStart.copyFrom(this.bullet.position);
                            // console.log("fireStart:",this.fireStart);
                        }
                    }
                }
            } else {
                if(this.dashTime <= 0){
                    this.dxn = 0;
                    this.dashTime = this.startDashTime;
                    this.dashing = false;
                    this.dashvelv.y = 0;
                    this.dashvelh.x = 0;
                } else {
                    this.dashTime -= scene.getEngine().getDeltaTime()/3000;
    
                    if(this.dxn == 1){ // up
                        this.dashvelv.y = .5;
                        this.player.moveWithCollisions(this.dashvelv);
                    } else if(this.dxn == 3){ // left
                        this.dashvelh = this.player.forward;
                        this.dashvelh.y += 0;
                        this.player.moveWithCollisions(this.dashvelh.scaleInPlace(0.5));
                        
                    } else if(this.dxn == 4){ //right
                        this.dashvelh = this.player.forward;
                        this.dashvelh.y = 0;
                        this.player.moveWithCollisions(this.dashvelh.scaleInPlace(-0.5));
                    }
                }
            }
        }
    }

    private registerUpdate(scene:Scene)
    {
        scene.registerBeforeRender(() => {
        
            //jump check
            const delta = scene.getEngine().getDeltaTime();
     
            if(this.velocity.y<=0){//create a ray to detect the ground as character is falling
                
                const ray = new Ray();
                const rayHelper = new RayHelper(ray);
                if(this.player) rayHelper.attachToMesh(this.player, new Vector3(0, -0.995, 0), new Vector3(0, 0, 0), 0.6);
    
                const pick = scene.pickWithRay(ray);
                if (pick) 
                {
                    this.onObject = pick.hit;

                }
                
            }
            this.velocity.y -= delta / 3000;
            if (this.onObject) {
                // console.log("onObject now");
                this.velocity.y = Math.max(0, this.velocity.y)
            };
            if (this.jumpKeyDown && this.onObject) {
 
                this.velocity.y = 0.20 ;
                this.onObject = false;
            }
        
            this.player?.moveWithCollisions(this.velocity);
        });
    }
    private registerAction(scene:Scene)
    {
        scene.actionManager = new ActionManager(scene);
        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyDownTrigger,  (evt) => {
            this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
    
            //checking jumps
            if (evt.sourceEvent.type == "keydown" && (evt.sourceEvent.key == "c" || evt.sourceEvent.key == " ")) {
                this.jumpKeyDown = true;
                // console.log("jumpKeyDown");
            }
        }));
        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyUpTrigger,  (evt) => {
            this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";
    
            //checking jumps
            if (evt.sourceEvent.type == "keyup" && (evt.sourceEvent.key == "c" || evt.sourceEvent.key == " ")) {
                this.jumpKeyDown = false;
                
            }
        }));
    
    }
    private gameObjects(scene:Scene)
    {
        this.player = this.asymmetryWithAxis(scene);
        if(this.player) 
        {
            this.player.isPickable = false;
            this.player.ellipsoid = new Vector3(0.5,0.5,0.5);
            this.player.position.x = -4;
        }
        this.camera.lockedTarget = this.player;

        //single testing platform
        var platform1 = Mesh.CreateBox("plat1", 2, scene);
        platform1.scaling = new Vector3(1,.25,1);
        platform1.position.y = 2;
        platform1.position.x = 4;
        var platmtl = new StandardMaterial("red",scene);
        platmtl.diffuseColor = new Color3(.5,.5,.8);
        platform1.material = platmtl;
        platform1.checkCollisions = true;

        this.fireball = MeshBuilder.CreateSphere("ball platform",{diameter:0.5},scene);
        this.fireball.material = platmtl;
        this.fireball.position.x = 4;
        this.fireball.position.y = 3;
        this.fireball.isVisible  = true;
        // if(this.ps) this.ps.emitter = ball;

        //shadows setting
        platform1.receiveShadows = true;
        this.shadowGenerator.getShadowMap()?.renderList?.push(platform1);
        if(this.player) this.shadowGenerator.getShadowMap()?.renderList?.push(this.player);
    }
    private _updateFrame()
    {
        if(this.player)
        {
            if(this.isPointerDown)
            {

                this.source = this.player.rotationQuaternion!;
                if(this.source) 
                {
                    this.player.rotationQuaternion = Quaternion.Slerp(this.source,this.target,0.3);
                }
                else 
                {
                    console.log("souce is null");
                }
            }
            if(this.ps)
            {
                // this.ps.emitter = new Vector3(this.player.position.x, this.player.position.y+0.5,this.player.position.z);
            }

            if(!this.bullet)
            {
                if(this.fireReady)
                {
                    console.log("clone a new fireball");
                    this.bullet = this.fireball.clone();
                    if(this.player)
                    {
                        this.bullet.position = Vector3.Zero();
                        this.bullet.position.y = 0.7;
                        this.bullet.isVisible = true;
                        this.bullet.parent = this.player;
                    }
                }
            }
            else if(this.fireStatus){
                if(this.distance < this.fireRanger)
                {
                    // console.log("distance:",this.distance);
                    let step = this.fireDirection;
                    step.y = 0;
                    // console.log("before norm:",step.length());
                    step = step.normalize();
                    // console.log("after norm:",step.length());
                    this.bullet.moveWithCollisions(step.scaleInPlace(this.fireVelocity));
                    // console.log("bullet pos:",this.bullet.position);
                    // console.log("start pos:",this.fireStart);
                    this.distance = this.bullet.position.subtract(this.fireStart).length();
                }
                else{
                    console.log("reset fire bullet");
                    this.bullet.position = Vector3.Zero();
                    this.bullet.position.y = 0.7;
                    this.bullet.parent = this.player;
                    this.distance = 0;
                    this.fireStatus = false;
                }
    
            }
        }
        else{
            console.log("player is null");
        }


    }
    private createCamera(scene: Scene) {
        var camera = new ArcRotateCamera("camera", -Math.PI/2, Math.PI / 2.5, 15, Vector3.Zero(), scene);
        camera.lowerRadiusLimit = 9;
        camera.upperRadiusLimit = 50;
        camera.attachControl(scene.getEngine().getRenderingCanvas(),true);
        camera._panningMouseButton = 1;
        return camera;
    }

    private isPointerDown: boolean = false;
    private registerPointerHandler() {
  
        this.scene.onPointerObservable.add((eventData) => {
            eventData.event.preventDefault();
            if (eventData.type === PointerEventTypes.POINTERDOWN && eventData.event.button === 2) {
                this.isPointerDown = true;
                // console.log("mouse key down");
            }
            else if (eventData.type === PointerEventTypes.POINTERMOVE) {
                // console.log("event button:",eventData.event.button);
                if (this.isPointerDown) {         
                    const a1 = this.camera.alpha;
                    this.target = Quaternion.FromEulerAngles(0,Math.PI - a1,0);
                    // console.log("mouse key move");
                }
            }
            else if (eventData.type === PointerEventTypes.POINTERUP && eventData.event.button === 2) {
                this.isPointerDown = false;
                // console.log("mouse key up")
            }
        });

    }

    private createEnvironment(scene: Scene) {

        //light
        const light = new HemisphericLight("light", new Vector3(0.5, 1, 0), scene);
        light.intensity = 0.7;
        scene.ambientColor = new Color3(0.3, 0.3, 0.3);
        // This creates a light, aiming 0,1,0 - to the sky (non-mesh)

        var light0 = new DirectionalLight("light", new Vector3(0,-1,0),scene);
        light0.position = new Vector3(20, 40, 20);
        // Default intensity is 1. Let's dim the light a small amount
        light0.intensity = 0.4;
        light0.specular = new Color3(1, 0.76, 0.76);
        this.shadowGenerator = new ShadowGenerator(1024, light0);

        //ground
        var ground = CreateGround("ground", { width: 50, height: 50 });
        ground.receiveShadows = true;  
        var groundMaterial = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseTexture = new Texture("https://assets.babylonjs.com/textures/wood.jpg", scene);
        groundMaterial.diffuseTexture.uScale = 30;
        groundMaterial.diffuseTexture.vScale = 30;
        groundMaterial.specularColor = new Color3(.1, .1, .1);
        ground.material = groundMaterial;

        //gravity
        scene.gravity = new Vector3(0, -0.9, 0);
        scene.collisionsEnabled = true;
        return scene;
    }
    // a local axis system to help you in need
    private localAxes(size: number): Mesh {
        var pilot_local_axisX = Mesh.CreateLines("pilot_local_axisX", [
            Vector3.Zero(), new Vector3(size, 0, 0), new Vector3(size * 0.95, 0.05 * size, 0),
            new Vector3(size, 0, 0), new Vector3(size * 0.95, -0.05 * size, 0)
        ], this.scene, false);
        pilot_local_axisX.color = new Color3(1, 0, 0);

        var pilot_local_axisY = Mesh.CreateLines("pilot_local_axisY", [
            Vector3.Zero(), new Vector3(0, size, 0), new Vector3(-0.05 * size, size * 0.95, 0),
            new Vector3(0, size, 0), new Vector3(0.05 * size, size * 0.95, 0)
        ], this.scene, false);
        pilot_local_axisY.color = new Color3(0, 1, 0);

        var pilot_local_axisZ = Mesh.CreateLines("pilot_local_axisZ", [
            Vector3.Zero(), new Vector3(0, 0, size), new Vector3(0, -0.05 * size, size * 0.95),
            new Vector3(0, 0, size), new Vector3(0, 0.05 * size, size * 0.95)
        ], this.scene, false);
        pilot_local_axisZ.color = new Color3(0, 0, 1);

        var local_origin = MeshBuilder.CreateBox("local_origin", { size: 1 }, this.scene);
        local_origin.isVisible = false;

        pilot_local_axisX.parent = local_origin;
        pilot_local_axisY.parent = local_origin;
        pilot_local_axisZ.parent = local_origin;

        return local_origin;

    }
    // an asymmetricall object  to help you not lost your direction
    private asymmetry(scene: Scene): Nullable<Mesh> {
        var body = MeshBuilder.CreateCylinder("body", { height: 1, diameterTop: 0.2, diameterBottom: 0.5, tessellation: 6, subdivisions: 1 }, scene);
        var front = MeshBuilder.CreateBox("front", { height: 1, width: 0.3, depth: 0.1875 }, scene);
        front.position.x = 0.125;
        var head = MeshBuilder.CreateSphere("head",{diameter:0.5},scene);
        head.position.y = 0.75;
        var arm = MeshBuilder.CreateCylinder("arm",{height: 1, diameter: 0.2, tessellation: 6, subdivisions: 1},scene);
        arm.rotation.x = Math.PI/2;
        arm.position.y = 0.25;

        var pilot = Mesh.MergeMeshes([body,front,head,arm], true);
        return pilot;
    }
    //combined an asymmetrical obect with axis
    private asymmetryWithAxis(scene:Scene):Nullable<Mesh>
    {
        // var localOrigin = this.localAxes(1);
        // localOrigin.rotation.y = Math.PI/2;
        var asymmetricalObject = this.asymmetry(scene);     
        // localOrigin.parent = asymmetricalObject;
        var material = new StandardMaterial("m", scene);
        material.diffuseColor = new Color3(1, 0, 5);
        if(asymmetricalObject)
        {
            asymmetricalObject.material = material;
            asymmetricalObject.position.y += 0.5;
            asymmetricalObject.rotationQuaternion = Quaternion.FromEulerAngles(0,-Math.PI/2,0);
  
        }
        return asymmetricalObject;
    }


}

new Game()
