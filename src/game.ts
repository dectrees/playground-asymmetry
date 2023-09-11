import './index.css';
import Recast from "recast-detour";

import {
    Animation,
    Vector3,
    Color3,
    Engine,
    Scene,
    ArcRotateCamera,
    HemisphericLight,
    CreateGround,
    MeshBuilder,
    StandardMaterial,
    PointerEventTypes,
    Mesh,
    Nullable,
    Scalar,
    Quaternion,
    ShadowGenerator,
    DirectionalLight,
    ActionManager,
    ExecuteCodeAction,
    Ray,
    RayHelper,
    Axis,
    AssetsManager,
    ParticleSystem,
    Texture,
    SphereParticleEmitter,
    Matrix,
    SolidParticleSystem,
    SolidParticle,
    RecastJSPlugin,
    TransformNode
} from "@babylonjs/core";


export default class Game {
    engine: Engine;
    scene: Scene;
    camera;
    canvas: HTMLCanvasElement;
    player: Nullable<Mesh> = null;
    source = Quaternion.FromEulerAngles(0, 0, 0);
    target = Quaternion.FromEulerAngles(0, 0, 0);
    shadowGenerator: ShadowGenerator;
    //jumping and collision with ground checks
    velocity = new Vector3();
    dashvelv = new Vector3();
    dashvelh = new Vector3();

    //Input detection
    jumpKeyDown = false;
    isJumping = false;
    navKeyDown = false;
    //inputs & keys
    inputMap = {};
    onObject = false;

    //dashes
    dashTime = 0;
    startDashTime = 0.1;
    dxn = 0; //which dxn dash should go
    dashing = false;

    //particle system
    ps: Nullable<ParticleSystem>;
    fireball: Mesh;
    bullet: Mesh;
    bandit: Mesh;
    banditClone: boolean = true;
    fireReady: boolean = false;
    fireStatus = false;
    fireRanger = 50;
    fireVelocity = 0.1;
    fireDirection: Vector3 = Vector3.Zero();
    distance = 0;
    fireStart: Vector3 = Vector3.Zero();
    trace: boolean = true;
    lightup: boolean = false;
    banditReady: boolean = false;

    //Animation
    xSlide: Animation;
    frameRate = 50;

    //explosion
    sps: SolidParticleSystem;
    speed = .5;
    gravity = -0.05;
    boom = false;

    //AI
    navigationPlugin?: RecastJSPlugin;
    agents;
    staticMesh;
    currentMesh?: Mesh;
    navmeshParameters = {
        cs: 0.5,
        ch: 0.5,
        walkableSlopeAngle: 90,
        walkableHeight: 1.0,
        walkableClimb: 1,
        walkableRadius: 1,
        maxEdgeLen: 12.,
        maxSimplificationError: 1.3,
        minRegionArea: 8,
        mergeRegionArea: 20,
        maxVertsPerPoly: 6,
        detailSampleDist: 6,
        detailSampleMaxError: 1,
    };
    DebugMesh = false;
    flyHeight = 3.0;
    restDistance = 0.1;
    onMission = false;
    crowd;
    agentParams = {
        radius: 0.1,
        height: 0.2,
        maxAcceleration: 4.0,
        maxSpeed: 2.0,
        collisionQueryRange: 0.5,
        pathOptimizationRange: 0.0,
        separationWeight: 1.0
    };

    startingPoint:Vector3;
    pathLine;

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
        this.xSlide = this.buildAnimation();
        this.engine.runRenderLoop(
            () => {
                this.scene.render();
            }
        );

        window.addEventListener("resize",  () => { 
            if(this.engine) {
              this.engine.resize();
            }
          });

        this.registerPointerHandler();
        this.scene.onBeforeRenderObservable.add(() => {
            this._updateSPS();
            this._updateFrame();
            this._checkInput(this.scene);
        });
        
        this.registerAction(this.scene);
        this.registerUpdate(this.scene);

        this.staticMesh = this.gameObjects(this.scene);
        this._loadParticleSystem(this.scene);
        this._loadRecast().then(() => {
            this._initCrowd(this.scene);
        }
        );

    }

    private async _loadRecast() {
        const recast = await Recast.bind(window)();
        this.navigationPlugin = new RecastJSPlugin(recast);
    }
    private _initCrowd(scene: Scene) {
        // console.log("start initCrowd");
        if (this.staticMesh && this.navigationPlugin) {
            // console.log("start initCrowd");
            this.navigationPlugin.createNavMesh([this.staticMesh], this.navmeshParameters);
            if(this.DebugMesh)
            {
                var navmeshdebug = this.navigationPlugin.createDebugNavMesh(scene);
                navmeshdebug.position = new Vector3(0, 0.01, 0);
    
                var matdebug = new StandardMaterial('matdebug', scene);
                matdebug.diffuseColor = new Color3(0.1, 0.2, 1);
                matdebug.alpha = 0.2;
                navmeshdebug.material = matdebug;
            }

            this.crowd = this.navigationPlugin.createCrowd(10, 0.1, scene);

            this.agents = [];
            for (let i = 0; i < 1; i++) {
                var width = 0.50;
                var agentCube = MeshBuilder.CreateBox("cube", { size: width, height: width }, scene);
                var robot = this.buildRobot(scene);

                var targetCube = MeshBuilder.CreateBox("cube", { size: 0.2, height: 0.2 }, scene);
                var matAgent = new StandardMaterial('mat2', scene);
                var variation = Math.random();
                matAgent.diffuseColor = new Color3(0.4 + variation * 0.6, 0.3, 1.0 - variation * 0.3);
                agentCube.material = matAgent;
                if(robot)
                {
                    robot.position.y = 1;
                    robot.parent = agentCube;
                    agentCube.isVisible = false;
                    targetCube.isVisible = false;
                    robot.material = matAgent;
                    this.shadowGenerator.getShadowMap()?.renderList?.push(robot);
                }
                var randomPos = this.navigationPlugin.getRandomPointAround(new Vector3(-2.0, 0.1, -1.8), 0.5);
                var transform = new TransformNode("agent");
                //agentCube.parent = transform;
                var agentIndex = this.crowd.addAgent(randomPos, this.agentParams, transform);
                this.agents.push({ idx: agentIndex, trf: transform, mesh: agentCube, target: targetCube });
            }

            setInterval(()=>{
                if (this.navigationPlugin &&this.player) {
                    // console.log("reset distance:",this.restDistance);
                    var agents = this.crowd.getAgents();
                    if(!this.onMission)
                    { 
                        var i;
                        for (i = 0; i < agents.length; i++) {
                            this.crowd.agentGoto(agents[i], this.navigationPlugin.getClosestPoint(this.player.position));
                        }
                    }
                    else if(this.restDistance < 0.5)
                    {
                        var i;
                        for (i = 0; i < agents.length; i++) {
                            this.crowd.agentGoto(agents[i], this.navigationPlugin.getClosestPoint(this.player.position));
                        }
                        this.onMission = false;
                    }
                }
            },3000);

            var getGroundPosition = function () {
                var pickinfo = scene.pick(scene.pointerX, scene.pointerY);
                if (pickinfo.hit) {
                    return pickinfo.pickedPoint;
                }

                return null;
            }

            var pointerDown = (mesh) => {
                if (this.navKeyDown) {
                    this.currentMesh = mesh;
                    this.startingPoint = getGroundPosition();
                    if (this.startingPoint) { // we need to disconnect camera from canvas
                        if (this.navigationPlugin) {
                            var agents = this.crowd.getAgents();
                            var i;
                            for (i = 0; i < agents.length; i++) {
                                var randomPos = this.navigationPlugin.getRandomPointAround(this.startingPoint, 1.0);
                                this.crowd.agentGoto(agents[i], this.navigationPlugin.getClosestPoint(this.startingPoint));
                            }
                            this.onMission = true;
                            var pathPoints = this.navigationPlugin.computePath(this.crowd.getAgentPosition(agents[0]), this.navigationPlugin.getClosestPoint(this.startingPoint));
                            // this.pathLine = MeshBuilder.CreateDashedLines("ribbon", { points: pathPoints, updatable: true, instance: this.pathLine }, scene);
                        }
                    }
                }
            }

            scene.onPointerObservable.add((pointerInfo) => {
                switch (pointerInfo.type) {
                    case PointerEventTypes.POINTERDOWN:
                        if (pointerInfo.pickInfo && pointerInfo.pickInfo.hit) {
                            pointerDown(pointerInfo.pickInfo.pickedMesh)
                        }
                        break;
                }
            });

            scene.onBeforeRenderObservable.add(() => {
                var agentCount = this.agents.length;
                for (let i = 0; i < agentCount; i++) {
                    var ag = this.agents[i];
                    ag.mesh.position = this.crowd.getAgentPosition(ag.idx);
                    if(this.startingPoint)
                    {
                        let restDistanceV = this.startingPoint.subtract(ag.mesh.position);
                        this.restDistance = restDistanceV.length();
                    }
                    let vel = this.crowd.getAgentVelocity(ag.idx);
                    // this.crowd.getAgentNextTargetPathToRef(ag.idx, ag.target.position);
                    if (vel.length() > 0.2) {
                        vel.normalize();
                        var desiredRotation = Math.atan2(vel.x, vel.z);
                        ag.mesh.rotation.y = ag.mesh.rotation.y + (desiredRotation - ag.mesh.rotation.y) * 0.05;
                    }
                }
            });

        }
    }

    private _updateSPS() {
        if (this.boom) {
            if (this.sps) {
                this.sps.setParticles();
            }

        }
    }

    private doExplode(scene: Scene) {
        this.sps = new SolidParticleSystem("SPS", scene);
        const tetra = MeshBuilder.CreatePolyhedron("tetra", { size: 0.2, type: 2 });
        this.sps.addShape(tetra, 10);
        tetra.dispose();

        var s = this.sps.buildMesh();
        s.position = this.bandit.position;
        this.buildSPS(this.sps, s.position.y);

        this.boom = true;
        this.bandit.dispose();
        this.bandit = null;
        setTimeout(() => {
            this.boom = false;
            this.sps.dispose();
            this.banditClone = true;
        }, 5000);
    }

    private buildSPS(sps: SolidParticleSystem, y: number) {

        // recycle particles function
        //sets particles to an intial state
        const recycleParticle = (particle) => {
            particle.position.x = 0;
            particle.position.y = 0;
            particle.position.z = 0;
            particle.rotation.x = Scalar.RandomRange(-Math.PI, Math.PI);
            particle.rotation.y = Scalar.RandomRange(-Math.PI, Math.PI);
            particle.rotation.z = Scalar.RandomRange(-Math.PI, Math.PI);
            particle.color = new Color3(Math.random(), Math.random(), Math.random());
            particle.velocity.x = Scalar.RandomRange(-0.3 * this.speed, 0.3 * this.speed);
            particle.velocity.y = Scalar.RandomRange(0.001 * this.speed, this.speed);
            particle.velocity.z = Scalar.RandomRange(-0.3 * this.speed, 0.3 * this.speed);
        };

        //Initate by recycling through all particles
        sps.initParticles = () => {
            for (let p = 0; p < sps.nbParticles; p++) {
                recycleParticle(sps.particles[p])
            }
        }
        sps.updateParticle = (particle) => {
            if (particle.position.y < -y + .5) {
                // recycleParticle(particle);
                particle.velocity = Vector3.Zero();
                return;
            }
            particle.velocity.y += this.gravity;                  // apply gravity to y
            particle.position.addInPlace(particle.velocity); // update particle new position

            const direction = Math.sign(particle.idx % 2 - 0.5); //rotation direction +/- 1 depends on particle index in particles array           // rotation sign and new value
            particle.rotation.z += 0.01 * direction;
            particle.rotation.x += 0.005 * direction;
            particle.rotation.y += 0.008 * direction;
        }

        sps.initParticles();
        sps.setParticles();
    }

    private buildAnimation(): Animation {
        const xSlide = new Animation("xSlide", "position.x", this.frameRate, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);

        const keyFrames = [];

        keyFrames.push({
            frame: 0,
            value: 0
        });

        keyFrames.push({
            frame: this.frameRate,
            value: -3
        });

        keyFrames.push({
            frame: 2 * this.frameRate,
            value: 0
        });
        keyFrames.push({
            frame: 3 * this.frameRate,
            value: 3
        });
        keyFrames.push({
            frame: 4 * this.frameRate,
            value: 0
        });

        xSlide.setKeys(keyFrames);

        return xSlide;
    }

    private _loadParticleSystem(scene: Scene) {
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

    private _checkInput(scene: Scene) {
        // dash implementation Blackthornprod unity tutorial
        // not dashing
        if (this.player) {
            // console.log("before check:", this.onObject);
            let keydown = false;
            let step = Vector3.Zero();
            if (!this.dashing) {
                if (this.inputMap["w"] || this.inputMap["ArrowUp"]) {
                    step = this.player.right;
                    step.y = 0;
                    this.player.moveWithCollisions(step.scaleInPlace(0.1));
                    // this.player.position.z+=0.1;
                    keydown = true;
                    this.dxn = 1;
                }
                if (this.inputMap["a"] || this.inputMap["ArrowLeft"]) {
                    step = this.player.forward;
                    step.y = 0;
                    this.player.moveWithCollisions(step.scaleInPlace(0.1));
                    keydown = true;
                    this.dxn = 3;
                }
                if (this.inputMap["s"] || this.inputMap["ArrowDown"]) {
                    step = this.player.right;
                    step.y = 0;
                    this.player.moveWithCollisions(step.scaleInPlace(-0.1));

                    keydown = true;
                }
                if (this.inputMap["d"] || this.inputMap["ArrowRight"]) {
                    step = this.player.forward;
                    step.y = 0;
                    this.player.moveWithCollisions(step.scaleInPlace(-0.1));
                    keydown = true;
                    this.dxn = 4;
                }
                if (this.inputMap["Shift"] && this.dxn != 0) {
                    keydown = true;
                    this.dashing = true;
                } else {
                    this.dxn = 0;
                }
                if (this.inputMap["f"]) {
                    if (this.bullet) {
                        if (!this.fireStatus) {
                            this.fireStatus = true;
                            this.fireDirection.copyFrom(this.player.right);
                            // this.fireDirection = this.player.right;
                            // console.log("fire directon:",this.fireDirection);
                            this.distance = 0;
                            this.bullet.setParent(null);
                            this.fireStart.copyFrom(this.bullet.position);
                            this.bullet.rotate(Vector3.Up(), Math.PI / 2);
                            // console.log("fireStart:",this.fireStart);
                        }
                    }
                }
            } else {
                if (this.dashTime <= 0) {
                   
                    this.dashTime = this.startDashTime;
                    this.dashvelv.y = 0;
                    this.dashvelh.x = 0;
                    this.dashing = false;
                    this.dxn = 0;
                    
                } else {
                    this.dashTime -= scene.getEngine().getDeltaTime() / 3000;

                    if (this.dxn == 1) { // up
                        this.dashvelv.y = .3;
                        this.player.moveWithCollisions(this.dashvelv);
                    } else if (this.dxn == 3) { // left
                        this.dashvelh = this.player.forward;
                        this.dashvelh.y += 0;
                        this.player.moveWithCollisions(this.dashvelh.scaleInPlace(0.5));

                    } else if (this.dxn == 4) { //right
                        this.dashvelh = this.player.forward;
                        this.dashvelh.y = 0;
                        this.player.moveWithCollisions(this.dashvelh.scaleInPlace(-0.5));
                    }
                }
            }
        }
    }

    private registerUpdate(scene: Scene) {
        scene.registerBeforeRender(() => {

            //jump check
            const delta = scene.getEngine().getDeltaTime();

            if (this.velocity.y <= 0) {//create a ray to detect the ground as character is falling

                const ray = new Ray();
                const rayHelper = new RayHelper(ray);
                if (this.player) rayHelper.attachToMesh(this.player, new Vector3(0, -0.995, 0), new Vector3(0, 0, 0), 0.6);

                const pick = scene.pickWithRay(ray);
                if (pick) {
                    this.onObject = pick.hit;

                }

            }
            this.velocity.y -= delta / 3000;
            if (this.onObject) {
                // console.log("onObject now");
                this.velocity.y = Math.max(0, this.velocity.y)
            };
            if (this.jumpKeyDown && this.onObject) {

                this.velocity.y = 0.20;
                this.onObject = false;
                // console.log("jump onObject:",this.onObject);
            }

            this.player?.moveWithCollisions(this.velocity);
        });
    }
    private registerAction(scene: Scene) {
        scene.actionManager = new ActionManager(scene);
        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";

            //checking jumps
            if (evt.sourceEvent.type == "keydown") {
                if ((evt.sourceEvent.key == "c" || evt.sourceEvent.key == " ")) {
                    this.jumpKeyDown = true;
                    // console.log("jumpKeyDown");
                }
                if (evt.sourceEvent.key == "z") {
                    this.navKeyDown = true;
                }
            }
        }));
        scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
            this.inputMap[evt.sourceEvent.key] = evt.sourceEvent.type == "keydown";

            //checking jumps
            if (evt.sourceEvent.type == "keyup") {

                if ((evt.sourceEvent.key == "c" || evt.sourceEvent.key == " ")) {
                    this.jumpKeyDown = false;
                    // console.log("jumpKeyDown");
                }
                if (evt.sourceEvent.key == "z") {
                    this.navKeyDown = false;
                }
            }
        }));

    }
    private gameObjects(scene: Scene) {

        const randomNumber = function (min, max) {
            if (min == max) {
                return (min);
            }
            var random = Math.random();
            return ((random * (max - min)) + min);
        };
        var box = MeshBuilder.CreateBox("crate", { size: 4 }, scene);
        var boxMaterial = new StandardMaterial("Mat", scene);
        boxMaterial.diffuseTexture = new Texture("https://assets.babylonjs.com/textures/crate.png", scene);
        box.material = boxMaterial;
        box.checkCollisions = true;

        var boxNb = 6;
        var theta = 0;
        var radius = 15;
        box.position = new Vector3((radius + randomNumber(-0.5 * radius, 0.5 * radius)) * Math.cos(theta + randomNumber(-0.1 * theta, 0.1 * theta)), 2, (radius + randomNumber(-0.5 * radius, 0.5 * radius)) * Math.sin(theta + randomNumber(-0.1 * theta, 0.1 * theta)));

        var boxes = [box];
        for (var i = 1; i < boxNb; i++) {
            theta += 2 * Math.PI / boxNb;
            var newBox = box.clone("box" + i);
            boxes.push(newBox);
            newBox.position = new Vector3((radius + randomNumber(-0.5 * radius, 0.5 * radius)) * Math.cos(theta + randomNumber(-0.1 * theta, 0.1 * theta)), 2, (radius + randomNumber(-0.5 * radius, 0.5 * radius)) * Math.sin(theta + randomNumber(-0.1 * theta, 0.1 * theta)));
        }

        this.player = this.asymmetryWithAxis(scene);
        if (this.player) {
            this.player.isPickable = false;
            this.player.ellipsoid = new Vector3(0.5, 0.5, 0.5);
            this.player.position.x = -4;
        }
        this.camera.lockedTarget = this.player;

        //ground
        var ground = CreateGround("ground", { width: 50, height: 50 });
        ground.receiveShadows = true;
        var groundMaterial = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseTexture = new Texture("https://assets.babylonjs.com/textures/wood.jpg", scene);
        groundMaterial.diffuseTexture.uScale = 30;
        groundMaterial.diffuseTexture.vScale = 30;
        groundMaterial.specularColor = new Color3(.1, .1, .1);
        ground.material = groundMaterial;

        var lowerGround = ground.clone("lowerGround");
        lowerGround.scaling.x = 3;
        lowerGround.scaling.z = 3;
        lowerGround.position.y = -16;
        lowerGround.receiveShadows = false;
        // lowerGround.material = ground.material.clone("lowerMat");
        var lowgroundMaterial = new StandardMaterial("lowgroundMaterial", scene);
        lowgroundMaterial.diffuseColor = new Color3(0, .5, 0);
        lowerGround.material = lowgroundMaterial;

        //single testing platform
        var platform1 = Mesh.CreateBox("plat1", 2, scene);
        platform1.scaling = new Vector3(1, .25, 1);
        platform1.position.y = 5;
        platform1.position.x = 4;
        var platmtl = new StandardMaterial("red", scene);
        platmtl.diffuseColor = new Color3(.5, .5, .8);
        platform1.material = platmtl;
        platform1.checkCollisions = true;

        this.fireball = MeshBuilder.CreateSphere("ball platform", { diameter: 0.5 }, scene);
        this.fireball.material = platmtl;
        this.fireball.position.x = 4;
        this.fireball.position.y = 6;
        this.fireball.isVisible = true;
        this.fireball.checkCollisions = false;


        //shadows setting
        platform1.receiveShadows = true;
        this.shadowGenerator.getShadowMap()?.renderList?.push(platform1);
        if (this.player) this.shadowGenerator.getShadowMap()?.renderList?.push(this.player);

        var staticmesh = Mesh.MergeMeshes([boxes[0], boxes[1], boxes[2], boxes[3], boxes[4], boxes[5], ground], true, true, undefined, false, true);
        if (staticmesh) staticmesh.receiveShadows = true;
        return staticmesh;
    }
    private _updateFrame() {
        if (this.bandit == null && this.banditReady && this.banditClone) {
            this.bandit = this.fireball.clone();
            // console.log("cloned a bandit");
            this.bandit.position = Vector3.Zero();
            this.bandit.position.z = 20;
            this.bandit.position.y = 4;
            this.bandit.isVisible = true;
            if (this.ps) {
                this.ps.emitter = this.bandit;
            }
            this.bandit.animations.push(this.xSlide);
            this.banditClone = false;
            this.scene.beginAnimation(this.bandit, 0, 4 * this.frameRate, true);
        }
        if (this.player) {
            if (this.isPointerDown) {

                this.source = this.player.rotationQuaternion!;
                if (this.source) {
                    this.player.rotationQuaternion = Quaternion.Slerp(this.source, this.target, 0.3);
                }
                else {
                    console.log("souce is null");
                }
            }
            if (this.ps) {
                // this.ps.emitter = new Vector3(this.player.position.x, this.player.position.y+0.5,this.player.position.z);
            }

            if (!this.bullet) {
                if (this.fireReady) {
                    // console.log("clone a new fireball");
                    this.bullet = this.fireball.clone();
                    if (this.player) {
                        this.bullet.position = Vector3.Zero();
                        this.bullet.position.y = 0.7;
                        this.bullet.isVisible = true;
                        this.bullet.parent = this.player;
                        this.ps?.stop();
                        if (this.ps) {
                            this.ps.emitter = null;
                            this.banditReady = true;
                        }
                    }
                }
            }
            else if (this.fireStatus) {
                let intersect = false;
                if (this.bandit) {
                    intersect = this.bullet.intersectsMesh(this.bandit);
                }
                if ((this.distance < this.fireRanger) && (!intersect)) {
                    // console.log("distance:",this.distance);
                    if (this.trace && this.bandit) {
                        const smatrix = Matrix.Zero();
                        const sscaling = Vector3.Zero();
                        const srotationQuaternion = Quaternion.Zero();
                        const stranslation = Vector3.Zero();

                        let step = Vector3.Zero();
                        step.copyFrom(this.bullet.forward);
                        // step.y = 0;
                        step = step.normalize();
                        Matrix.LookAtLHToRef(Vector3.Zero(), step, Axis.Y, smatrix);
                        smatrix.decompose(sscaling, srotationQuaternion, stranslation);
                        this.bullet.rotationQuaternion = srotationQuaternion.invertInPlace();
                        this.bullet.moveWithCollisions(step.scaleInPlace(this.fireVelocity));


                        const matrix = Matrix.Zero();
                        const scaling = Vector3.Zero();
                        const rotationQuaternion = Quaternion.Zero();
                        const translation = Vector3.Zero();

                        Matrix.LookAtLHToRef(this.bullet.position, this.bandit.position, Axis.Y, matrix);
                        matrix.decompose(scaling, rotationQuaternion, translation);
                        let destQuaternion = rotationQuaternion.invertInPlace();
                        this.bullet.rotationQuaternion = Quaternion.Slerp(this.bullet.rotationQuaternion, destQuaternion, 0.05);

                        this.distance = this.bullet.position.subtract(this.fireStart).length();
                    }
                    else {
                        let step = this.fireDirection;
                        step.y = 0;
                        step = step.normalize();
                        this.bullet.moveWithCollisions(step.scaleInPlace(this.fireVelocity));
                        this.distance = this.bullet.position.subtract(this.fireStart).length();
                    }
                }
                else {
                    // console.log("reset fire bullet");
                    if (intersect) {
                        if (!this.lightup) {
                            this.lightup = true;
                            this.ps?.start();
                            setTimeout(() => {
                                this.ps?.stop();
                                if (this.ps) this.ps.emitter = null;
                                this.lightup = false;
                                this.doExplode(this.scene);
                            }, 3000);
                        }

                    }
                    this.bullet.position = Vector3.Zero();
                    this.bullet.position.y = 0.7;
                    this.bullet.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 0);
                    this.bullet.parent = this.player;
                    this.distance = 0;
                    this.fireStatus = false;
                }

            }
        }
        else {
            console.log("player is null");
        }


    }
    private createCamera(scene: Scene) {
        var camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, Vector3.Zero(), scene);
        camera.lowerRadiusLimit = 9;
        camera.upperRadiusLimit = 50;
        camera.upperBetaLimit = Math.PI / 2;
        camera.lowerBetaLimit = Math.PI / 4;
        camera.attachControl(scene.getEngine().getRenderingCanvas(), true);
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
                    this.target = Quaternion.FromEulerAngles(0, Math.PI - a1, 0);
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

        var light0 = new DirectionalLight("light", new Vector3(0, -1, 0), scene);
        light0.position = new Vector3(20, 40, 20);
        // Default intensity is 1. Let's dim the light a small amount
        light0.intensity = 0.4;
        light0.specular = new Color3(1, 0.76, 0.76);
        this.shadowGenerator = new ShadowGenerator(1024, light0);

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
        var head = MeshBuilder.CreateSphere("head", { diameter: 0.5 }, scene);
        head.position.y = 0.75;
        var arm = MeshBuilder.CreateCylinder("arm", { height: 1, diameter: 0.2, tessellation: 6, subdivisions: 1 }, scene);
        arm.rotation.x = Math.PI / 2;
        arm.position.y = 0.25;

        var pilot = Mesh.MergeMeshes([body, front, head, arm], true);
        return pilot;
    }

    private buildRobot(scene:Scene): Nullable<Mesh>
    {
        var width = 0.50;
        var agentCube = MeshBuilder.CreateBox("cube", { size: width, height: width }, scene);
        var head = MeshBuilder.CreateSphere("head", { diameter: 0.3 }, scene);
        head.position.y = 0.4;
        var arm = MeshBuilder.CreateCylinder("arm", { height: 1, diameter: 0.1, tessellation: 6, subdivisions: 1 }, scene);
        arm.position.y = 0.15;
        arm.rotation.z = Math.PI/2;

        var pilot = Mesh.MergeMeshes([agentCube, head, arm], true);
        return pilot;
    }
    //combined an asymmetrical obect with axis
    private asymmetryWithAxis(scene: Scene): Nullable<Mesh> {
        // var localOrigin = this.localAxes(1);
        // localOrigin.rotation.y = Math.PI/2;
        var asymmetricalObject = this.asymmetry(scene);
        // localOrigin.parent = asymmetricalObject;
        var material = new StandardMaterial("m", scene);
        material.diffuseColor = new Color3(1, 0, 5);
        if (asymmetricalObject) {
            asymmetricalObject.material = material;
            asymmetricalObject.position.y += 0.5;
            asymmetricalObject.rotationQuaternion = Quaternion.FromEulerAngles(0, -Math.PI / 2, 0);

        }
        return asymmetricalObject;
    }


}

new Game()
