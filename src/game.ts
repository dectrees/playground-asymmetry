import { Vector3, Color3, Engine, Scene, ArcRotateCamera, HemisphericLight, CreateGround, MeshBuilder, StandardMaterial, PointerEventTypes, Mesh, Nullable, Scalar, Quaternion, ShadowGenerator, DirectionalLight, ActionManager, ExecuteCodeAction, Ray, RayHelper, Axis } from "@babylonjs/core";
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
        this.test(this.scene);
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
                        console.log("dash left");
                        
                    } else if(this.dxn == 4){ //right
                        this.dashvelh = this.player.forward;
                        this.dashvelh.y = 0;
                        this.player.moveWithCollisions(this.dashvelh.scaleInPlace(-0.5));
                        console.log("dash right");
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
            // console.log("rotate:",this.player?.rotation.y);
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
 
                this.velocity.y = 0.25;
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
    private test(scene:Scene)
    {
        this.player = this.asymmetryWithAxis(scene);
        if(this.player) 
        {
            this.player.isPickable = false;
            this.player.ellipsoid = new Vector3(0.5,0.5,0.5);
            // this.player.setDirection(Axis.X);
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
        //shadows setting
        platform1.receiveShadows = true;
        this.shadowGenerator.getShadowMap()?.renderList?.push(platform1);
        if(this.player) this.shadowGenerator.getShadowMap()?.renderList?.push(this.player);
    }
    private _updateFrame()
    {
        // if(this.player) this.player.rotation.y = Scalar.Lerp(this.player.rotation.y, this.targetY,0.2);
        if(this.player)
        {
            if(this.isPointerDown)
            {

                this.source = this.player.rotationQuaternion!;
                if(this.source) 
                {
                    this.player.rotationQuaternion = Quaternion.Slerp(this.source,this.target,0.3);
                    // console.log("rotationQuaternion:",this.player.rotationQuaternion);
                }
                else 
                {
                    console.log("souce is null");
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
