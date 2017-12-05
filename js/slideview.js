var slideview = (function() {
    // Define global variables
    var imageInfo = {};                    // For saving slides informations
    var config = {};                       // Config file
    var currentImage = undefined;
    var currentImageInfo = undefined;
    var currentDataset = undefined;
    var currentDatasetInfo = undefined;
    var prevImage = undefined;
    var currentRegion = null;
    var currentRegionId = undefined;
    var currentSlate = null;
    var currentColorRegion = undefined;
    var imagingHelper = undefined;

    var shortcuts = [];
    var isAnnotationLoading = false;
    var prevRegion = null;
    var copyRegion = null;
    var currentHandle = undefined;

    var viewer = undefined;
    var magicV = 1000; // changed in  initAnnotationOverlay

    var navEnabled = true;
    var toolMessageUp = false;

    var isDrawingRegion = false;
    var isDrawingPolygon = false;
    var isTapDevice = false;

    var selectedTool = undefined;
    var prevTool = undefined;

    /************************************************************
        CONFIGURATION
    ************************************************************/
    // Initilize SlideView
    function initialize_slideview(slideInfo) {
        console.log("> initialize slideview");

        var def = $.Deferred();
        imageInfo = slideInfo;

        var config_path = "/static/slide/config/slide_configuration.json";

        $.getJSON(config_path, function(data) {
            config = data;
            config.isMac = navigator.platform.match(/Mac/i)?true:false;
            config.isIOS = navigator.platform.match(/(iPhone|iPod|iPad)/i)?true:false;

            initMicrodraw();
            def.resolve();
        });

        return def.promise();
    };

    function reset_slideview() {
        imageInfo = {};
        config = {};
        currentImage = undefined;
        currentImageInfo = undefined;
        currentDataset = undefined;
        currentDatasetInfo = undefined;
        prevImage = undefined;
        currentRegion = null;
        currentRegionId = undefined;
        currentSlate = null;
        currentColorRegion = undefined;
        imagingHelper = undefined;

        shortcuts = [];
        isAnnotationLoading = false;
        prevRegion = null;
        copyRegion = null;
        currentHandle = undefined;


        viewer = undefined;
        magicV = 1000; // changed in  initAnnotationOverlay


        navEnabled = true;
        toolMessageUp = false;

        isDrawingRegion = false;
        isDrawingPolygon = false;
        isTapDevice = false;


        selectedTool = undefined;
        prevTool = undefined;

        $(".openseadragon-container").remove();
        $(".overlay").remove();
    };

    configTools();

    function initMicrodraw() {
        if( config.debug ) console.log("> initMicrodraw");

        // var def = $.Deferred();
        isAnnotationLoading = false;
        // configTools();

        initOpenSeadragon();
        // initDatasets();
        initSlides();
        initConclusion();
        initRegionsMenu();
        // initFilmstrip();
        // def.resolve();

        // resize window to fit display
        $(window).resize(function() {
            // $("#regionList").height($(window).height() - $("#regionList").offset().top);
            resizeAnnotationOverlay();
        });
        // return def.promise();
    };

    function initSlides() {
        currentDataset = Object.keys(imageInfo["datasets"])[0];
        currentDatasetInfo = imageInfo.datasets[currentDataset];
        var firstImage = Object.keys(currentDatasetInfo.images)[0];

        // var firstImage = Object.keys(imageInfo.images)[0];
        loadImage(firstImage);
    };


    function loadImage(name) {
        if( config.debug ) console.log("> loadImage( " + name + " )");
        if (!currentDatasetInfo.images[name]) {
            console.log("ERROR: Image not found.");
            return;
        }

        clearRegions();
        updateCurrentImage(name);

        if (name !== undefined) {
          viewer.open("/slide/" + currentImageInfo.dzi); // localhost/name.dzi
          var viewport = viewer.viewport;
          window.setTimeout(function () {
             viewport.goHome(true);
          }, 200 );

          // viewer.scalebar({
          //     pixelsPerMeter: currentImageInfo.pixelsPerMeter
          // });
        } else {
            if (config.debug) console.log("> "+name+" could not be found");
            var viewport = viewer.viewport;
            window.setTimeout(function () {
               viewport.goHome(true);
            }, 200 );
        }
        // console.log("> zoom out: " + $('img#zoom-out').attr('title'));
        $('img#zoom-out').attr('title', '缩小视图');
        $('img#zoom-in').attr('title', '放大视图');
        $('img#home').attr('title', '返回主页');
        resetAudio();
    };

    function loadNextImage() {
        if($(document.activeElement).is('textarea')) return;
        if( config.debug ) console.log("> loadNextImage");
        var currentImageOrder = currentDatasetInfo.imageOrder;
        var index = currentImageOrder.indexOf(currentImage);
        var nextIndex = (index + 1) % currentImageOrder.length;

        loadImage(currentImageOrder[nextIndex]);

        // if( config.debug ) console.log("> loadNextImage");
        // var currentImageOrder = imageInfo.imageOrder;
        // var index = currentImageOrder.indexOf(currentImage);
        // var nextIndex = (index + 1) % currentImageOrder.length;
        //
        // loadImage(currentImageOrder[nextIndex]);
    };

    function loadPreviousImage() {
        if($(document.activeElement).is('textarea')) return;
        if(config.debug) console.log("> loadPrevImage");
        var currentImageOrder = currentDatasetInfo.imageOrder;
        var index = currentImageOrder.indexOf(currentImage);
        var previousIndex = ((index - 1 >= 0)? index - 1 : currentImageOrder.length - 1);

        loadImage(currentImageOrder[previousIndex]);

        // if( config.debug ) console.log("> loadPrevImage");
        // var currentImageOrder = imageInfo.imageOrder;
        // var index = currentImageOrder.indexOf(currentImage);
        // var previousIndex = ((index - 1 >= 0)? index - 1 : currentImageOrder.length - 1);
        //
        // loadImage(currentImageOrder[previousIndex]);
    };


    function updateCurrentImage(name) {
        prevImage = currentImage;
        currentImage = name;
        currentImageInfo = currentDatasetInfo.images[currentImage];
    };

    function microdrawDBSave() {
        if (config.debug) console.log("> save promise");
        // key
        var key = "regionPaths";
        var value = {};

        for (var dataset in imageInfo.datasets) {
            var datasetInfo = imageInfo.datasets[dataset];
            for (var slicename in datasetInfo.images) {
                var slice = datasetInfo.images[slicename];

                if (slice != currentImageInfo) {
                    continue;
                }
                // configure value to be saved
                value.regions = {};
                // cycle through regions
                for (var regionId in slice.regions) {
                    var region = slice.regions[regionId];
                    var region_path = region.path.clone({insert: false});
                    complexifyRegion(region_path);
                    var el = {};
                    // converted to JSON and then immediately parsed from JSON?
    //                    console.log(region.path);
                    el.path = JSON.parse(region_path.exportJSON());
    //                    console.log(el.path);
                    var contour={};
                    contour.Points=[];

                    // 2017.7.7 moodify cycle through points on region, converting to image coordinates
                    for (var i = 0; i < region_path.segments.length; i++) {
                        var point = paper.view.projectToView(region_path.segments[i].point);
                        var x = imagingHelper.physicalToDataX(point.x);
                        var y = imagingHelper.physicalToDataY(point.y);
                        contour.Points.push({"x": x, "y": y});
                    }

                    contour.slates = [];
                    el.slates = [];
                    if (region.slates.length > 0) {
                        for (var i = 0; i < region.slates.length; i++) {
                            var regSeg = region.slates[i];
                            var regSeg_path = regSeg.clone({insert: false});
                            complexifyRegion(regSeg_path);
                            el.slates.push(JSON.parse(regSeg_path.exportJSON()));
                            var slatePoints = [];
                            for (var j = 0; j < regSeg_path.length; j++) {
                                var segment = regSeg_path.segments[j];
                                var point = paper.view.projectToView(segment.point);
                                var x = imagingHelper.physicalToDataX(point.x);
                                var y = imagingHelper.physicalToDataY(point.y);
                                slatePoints.push({"x": x, "y": y});
                            }
                            contour.slates.push(slatePoints);
                            regSeg_path.remove();
                        }
                    }
                    region_path.remove();

                    el.contour = contour;
                    el.name = region.name;
                    el.description = 'region'+regionId+'.mp3';
                    //el.transcript = region.transcript;
                    el.transcript = $("#desp-"+regionId).val();
                    value.regions[regionId] = el;
                }

                // check if the slice annotations have changed since loaded by computing a hash
                var h = hash(JSON.stringify(value.regions)).toString(16);
                if (config.debug) console.log("hash:", h, "original hash:", slice.Hash);

                value.Hash = h;

                formdata = {
                  'name': slice.name,
                  'dataset': datasetInfo.folder,
                  'conclusion': slice.conclusion,
                  'info': JSON.stringify(value),
                  'action': 'save',
                };

                (function(slice, h) {
                    if (config.debug) console.log("< start post of contours information");
                    $.ajax({
                        type: 'POST',
                        url: '/slide/uploadinfo',
                        data: formdata,
                        success: function(result) {
                            slice.Hash = h;
                            var result = $.parseJSON(result);
                            if (config.debug) console.log("< Save" + result);
                            //show dialog box with timeout
                            console.log("Results status: " + result['status']);
                            if (result['status'] === "success")
                                saveMessage("Conclusion Saved", 500, 2000);
                            if (result['status'] === "error")
                                saveMessage("Saving Error", 500, 2000);
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            if (config.debug) console.log("< microdrawDBSave resolve: ERROR: " + textStatus + " " + errorThrown,"slice: "+slice.name.toString());
                            //show dialog box with timeout
                            saveMessage("Saving Error", 500, 2000);
                        }
                    });
                })(slice, h);

                if (config.debug) console.log("> end of saving contour inforation");
            }
        }

    };

    function microdrawDBLoad() {
      if (config.debug) console.log("> microdrawDBLoad promise");
      var	def = $.Deferred();
      var	key = "regionPaths";
      var slice = currentImage;

      $.ajax({
        type: 'POST',
        url: '/slide/uploadinfo',
        data: {
          'name': currentImageInfo.name,
          'dataset': currentDatasetInfo.folder,
          'action': 'load',
        },

        success: function(data) {
            if (config.debug) console.log("> got the regions data from the server");
            isAnnotationLoading = false;

            // do not display this one and load the current slice.
            if( slice != currentImage ) {
                microdrawDBLoad()
                .then(function() {
                    // $("#regionList").height($(window).height()-$("#regionList").offset().top);
                    updateRegionList();
                    paper.view.draw();
                });
                def.fail();
                return;
            }
            if (config.debug) console.log('[',data,']');
            // if there is no data on the current slice
            // save hash for the image nonetheless
            if (data.length == 0) {
                currentImageInfo.Hash = hash(JSON.stringify(currentImageInfo.regions)).toString(16);
                return;
            }

            // parse the data and add to the current canvas
            var obj = data;   //JSON.parse(data);

            if (JSON.stringify(obj) != JSON.stringify({})) {
                if (config.debug) console.log("> got the regions data from the server");
                currentImageInfo.nRegions = 0;
                for (var regionId in obj.regions) {
                    var objRegion = obj.regions[regionId];
                    var region = {};
                    var	json;
                    region.name = objRegion.name;
                    region.description = objRegion.description;
                    region.regionId = objRegion.regionId;
                    region.transcript = objRegion.transcript;
                    region.foldername = obj.img_name;
                    region.path = new paper.Path();
                    region.path.importJSON(objRegion.path);
                    region.slates = [];
                    console.log(objRegion.path);
                    for (i = 0; i < objRegion.slates.length; i++) {
                        region.slates.push(new paper.Path());
                        region.slates[i].importJSON(objRegion.slates[i]);
                    }

                    newRegion({name: region.name,
                               path: region.path,
                               slates: region.slates,
                               regionId: region.regionId,
                               foldername: region.foldername,
                               description: region.description,
                               transcript: region.transcript});
                    // currentImageInfo.nRegions++;
                }

                // saving diag_res for current image, for slider back and forth usage. in Load:
                currentImageInfo.conclusion = obj.conclusion;
                paper.view.draw();
                // if image has no hash, save one
                currentImageInfo.Hash = (obj.Hash ? obj.Hash : hash(JSON.stringify(currentImageInfo.regions)).toString(16));
            }
            if (config.debug) console.log("> success. Number of regions: ", currentImageInfo.nRegions);

            def.resolve();
        },
        error: function(jqXHR, textStatus, errorThrown) {
            if (config.debug) console.log("< microdrawDBLoad resolve ERROR: " + textStatus + " " + errorThrown);
            isAnnotationLoading = false;
        }
      });

      return def.promise();

    };


    /************************************************************
        Slide view and region annotation
    ************************************************************/

    function initOpenSeadragon() {
        // create OpenSeadragon viewer
        if (config.debug) console.log("> initOpenSeadragon");

        // set default values for new regions (general configuration)
        if (config.defaultStrokeColor == undefined) config.defaultStrokeColor = 'black';
        if (config.defaultStrokeWidth == undefined) config.defaultStrokeWidth = 1;
        if (config.defaultFillAlpha == undefined) config.defaultFillAlpha = 0.3;
        if (config.defaultSlateAlpha == undefined) config.defaultSlateAlpha = 0.5;

        viewer = OpenSeadragon({
            id: "openseadragon1",
            prefixUrl: "../../../static/slide/js/openseadragon/images/",
            tileSources: [],
            showReferenceStrip: false,
            referenceStripSizeRatio: 0.2,
            showNavigator: true,
            sequenceMode: false,
            navigatorId:"myNavigator",
            zoomInButton:"zoom-in",
            zoomOutButton:"zoom-out",
            homeButton:"home",
            preserveViewport: true
        });
        imagingHelper = viewer.activateImagingHelper({});

        // add the scalebar
        // viewer.scalebar({
        //     type: OpenSeadragon.ScalebarType.MICROSCOPE,
        //     minWidth:'150px',
        //     pixelsPerMeter: config.pixelsPerMeter,
        //     color:'black',
        //     fontColor:'black',
        //     backgroundColor:"rgba(255,255,255,0.5)",
        //     barThickness:4,
        //     location: OpenSeadragon.ScalebarLocation.TOP_RIGHT,
        //     xOffset:5,
        //     yOffset:5
        // });

        // add handlers: update slice name, animation, page change, mouse actions
        viewer.addHandler('open',function(){
            initAnnotationOverlay();
            updateSliceName();
            setImageConclusion();
        });
        viewer.addHandler('animation', function(event){
            transformViewport();
        });
        viewer.addHandler("page", function (data) {
            if (config.debug) console.log(data.page, config.tileSources[data.page]);
        });
        viewer.addViewerInputHook({hooks: [
            {tracker: 'viewer', handler: 'clickHandler', hookHandler: clickHandler},
            {tracker: 'viewer', handler: 'pressHandler', hookHandler: pressHandler},
            {tracker: 'viewer', handler: 'dragHandler', hookHandler: dragHandler},
            {tracker: 'viewer', handler: 'dragEndHandler', hookHandler: dragEndHandler}
        ]});
    };

    function initAnnotationOverlay(data) {
        if (config.debug) console.log("> initAnnotationOverlay");

        // do not start loading a new annotation if a previous one is still being loaded
        if (isAnnotationLoading == true) {
            return;
        }

        // if this is the first time a slice is accessed, create its canvas, its project,
        // and load its regions from the database
        if (currentImageInfo.projectID == undefined) {

            // create canvas
            var canvas = $("<canvas class='overlay' id='" + currentImage + "'>");
            $("body").append(canvas);

            // create project
            paper.setup(canvas[0]);
            currentImageInfo.projectID = paper.project.index;

            microdrawDBLoad().then(function(){
                // $("#regionList").height($(window).height() - $("#regionList").offset().top);
                setImageConclusion();
                updateRegionList();
                paper.view.draw();
            });


            if (config.debug) console.log('Set up new project, currentImage: ' + currentImage + ', ID: ' + currentImageInfo.projectID);
        }

        // activate the current slice and make it visible
        paper.projects[currentImageInfo.projectID].activate();
        paper.project.activeLayer.visible = true;
        $(paper.project.view.element).show();

        // resize the view to the correct size
        var width = $("body").width();
        var height = $("body").height();
        paper.view.viewSize = [width, height];
        paper.settings.handleSize = 10;
        updateRegionList();
        paper.view.draw();

        /* RT: commenting this line out solves the image size issues */
        // set size of the current overlay to match the size of the current image
        magicV = viewer.world.getItemAt(0).getContentSize().x / 100;

        transformViewport();
    };


    function resizeAnnotationOverlay() {
        if (config.debug) console.log("> resizeAnnotationOverlay");

        var width = $("body").width();
        var height = $("body").height();
        $("canvas.overlay").width(width);
        $("canvas.overlay").height(height);
        paper.view.viewSize = [width, height];
    };

    function updateSliceName() {
        if (config.debug) console.log("updateslidename:" + currentImage);
        di = currentImageInfo.name;
        $("#slice-name").html(currentImageInfo.name);
        // $("title").text("Diagnosis | " + pat_id_info);
    };

    function setImageConclusion() {
        $("#slide_conclusion").val(currentImageInfo.conclusion);
    };

    function initConclusion() {
        $("#slide_conclusion").change(function () {
            currentImageInfo.conclusion = $("#slide_conclusion").val();
        });
    };




    function highlightRegion(regionId) {
        /* get current alpha & color values for colorPicker display */
        if( config.debug ) console.log("> highlightRegion");

        var region = currentImageInfo.regions[regionId];
        if( region ) {
            currentColorRegion = region;
            var alpha = region.path.fillColor.alpha;
            $('#alphaSlider').val(alpha*100);
            $('#alphaFill').val(parseInt(alpha*100));

            var hexColor = getHexColor(region);
            if( config.debug ) console.log(hexColor);

            $('#fillColorPicker').val(hexColor);

            if ($('#colorSelector').css('display') == 'none') {
                $('#colorSelector').css('display', 'block');
            } else {
                $('#colorSelector').css('display', 'none');
            }
        }
    };


    function finishDrawingPolygon(closed) {
        // finished the drawing of the polygon
        if( closed == true ) {
            currentRegion.path.closed = true;
            currentRegion.path.fillColor.alpha = config.defaultFillAlpha;
        } else {
            currentRegion.path.fillColor.alpha = 0;
        }
        currentRegion.path.fullySelected = true;
        //currentRegion.path.smooth();
        isDrawingPolygon = false;
    }

    function backToPreviousTool() {
        setTimeout(function() {
            setSelectedTool(prevTool);
        },500);
    };

    function backToSelect() {
        setTimeout(function() {
            setSelectedTool("select");
        },500);
    };









    /*****************************************************************************
    EVENT HANDLERS
    *****************************************************************************/
    function clickHandler(event) {
        if( config.debug ) console.log("> clickHandler");

        event.stopHandlers = !navEnabled;
        if( selectedTool == "draw" ) {
            checkRegionSize(currentRegionId);
        }
    };
    function pressHandler(event) {
        if( config.debug ) console.log("> pressHandler");

        if( !navEnabled ) {
            event.stopHandlers = true;
            mouseDown(event.originalEvent.layerX, event.originalEvent.layerY);
        }
    };
    function dragHandler(event) {
        if( config.debug > 1 )	console.log("> dragHandler");

        if( !navEnabled ) {
            event.stopHandlers = true;
            mouseDrag(event.originalEvent.layerX,
                      event.originalEvent.layerY,
                      event.delta.x,
                      event.delta.y);
        }
    };
    function dragEndHandler(event) {
        if( config.debug ) console.log("> dragEndHandler");

        if( !navEnabled ) {
            event.stopHandlers = true;
            mouseUp();
        }
    };

    function singlePressOnRegion(event) {
        if( config.debug ) console.log("> singlePressOnRegion");

        event.preventDefault();

        if (event.target !== event.currentTarget) {
            var el = $(this);

            if ($(event.target).hasClass("region-tag")) {
                regionId = event.target.id;
            } else {
                regionId = event.target.parentNode.id;
            }
            var region = currentImageInfo.regions[regionId];

            if ($(event.target).hasClass("eye")) {
                toggleRegion(region);
            } else {
                selectRegion(region);
            }
        }
        event.stopPropagation();
    };
    function doublePressOnRegion(event) {
        if( config.debug ) console.log("> doublePressOnRegion");

        event.preventDefault();

        if (event.target !== event.currentTarget) {
            var regionId;
            if ($(event.target).hasClass("region-tag")) {
                regionId = event.target.id;
            } else {
                regionId = event.target.parentNode.id;
            }

            if ($(event.target).hasClass("eye")) {
                toggleRegion(regionId);
            } else {
                var region = currentImageInfo.regions[regionId];
                if( region.path.fillColor != null ) {
                    if( region ) {
                        var region = currentImageInfo.regions[regionId];
                        selectRegion(region);
                    }
                    highlightRegion(regionId);
                }
                if( config.isDrawingEnabled ) {
                    var name = prompt("Region name", region.name);
                    if( name != null && name.length > 0 ) {
                        changeRegionName(regionId, name);
                    }
                }
            }
        }
        event.stopPropagation();
    };

    function handleRegionTap(event) {
        /* Handles single and double tap in touch devices */
        if( config.debug ) console.log("> handleRegionTap");

        if( !isTapDevice ){ //if tap is not set, set up single tap
            isTapDevice = setTimeout(function() {
                isTapDevice = null;
            }, 300);

            // call singlePressOnRegion(event) using 'this' as context
            singlePressOnRegion.call(this, event);
        } else {
            clearTimeout(isTapDevice);
            isTapDevice = null;

            // call doublePressOnRegion(event) using 'this' as context
            doublePressOnRegion.call(this, event);
        }
        if( config.debug ) console.log("< handleRegionTap");
    };
    function mouseDown(x,y) {
        if( config.debug > 1 ) console.log("> mouseDown");

//        mouseUndo = getUndo();
        var point = paper.view.viewToProject(new paper.Point(x,y));

        currentHandle = null;

        switch( selectedTool ) {
            case "select":
            case "addpoint":
            case "delpoint":
            case "addregion":
            case "delregion":
            case "splitregion": {
                var hitResult = paper.project.hitTest(point, {
                    tolerance: 5,
                    stroke: false,
                    segments: true,
                    fill: true,
                    handles: true,
                    points: true,
                    position: true
                });

                paper.project.deselectAll();
                isDrawingRegion = false;
                if( hitResult ) {
                    var region = hitResult.item.owner;
                    var regionId = region.id;

                    // select path
                    if( currentRegion && currentRegion != region ) {
                        currentRegion.path.selected = false;
                        currentRegion.path.bringToFront();
                        prevRegion = currentRegion;
                    }
                    selectRegion(hitResult.item);

                    if( hitResult.type == 'handle-in' ) {
                        currentHandle = hitResult.segment.handleIn;
                        currentHandle.point = point;
                    } else if( hitResult.type == 'handle-out' ) {
                        currentHandle = hitResult.segment.handleOut;
                        currentHandle.point = point;
                    } else if( hitResult.type == 'segment' ) {
                        if( selectedTool == "select" ) {
                            currentHandle = hitResult.segment.point;
                            currentHandle.point = point;
                        }
                        if( selectedTool == "delpoint" ) {
                            hitResult.segment.remove();
//                            commitMouseUndo();
                        }
                    } else if (hitResult.type == 'stroke' && selectedTool == "addpoint") {
                        currentRegion.path
                            .curves[hitResult.location.index]
                            .divide(hitResult.location);
                        currentRegion.path.fullySelected = true;
//                        commitMouseUndo();
                        paper.view.draw();
                    } else if( selectedTool == "addregion" ) {
                        if( prevRegion ) {
                            var newPath = currentRegion.path.unite(prevRegion.path);
                            removeRegion(region);
                            currentRegion.path.remove();
                            currentRegion.path = newPath;
                            updateRegionList();
                            selectRegion(region);
                            paper.view.draw();
//                            commitMouseUndo();
                            backToSelect();
                        }
                    } else if( selectedTool == "delregion" ) {
                        if( prevRegion ) {
                            var newPath = prevRegion.path.subtract(currentRegion.path);
                            removeRegion(hitResult.item);
                            prevRegion.path.remove();
                            newRegion({path:newPath});
                            updateRegionList();
                            selectRegion(region);
                            paper.view.draw();
//                            commitMouseUndo();
                            backToSelect();
                        }
                    } else if( selectedTool == "splitregion" ) {
                        /*selected region is prevRegion!
                        region is the region that should be split based on prevRegion
                        newRegionPath is outlining that part of region which has not been overlaid by prevRegion
                        i.e. newRegion is what was region
                        and prevRegion color should go to the other part*/
                        if( prevRegion ) {
                            var prevColor = prevRegion.path.fillColor;
                            //color of the overlaid part
                            var color = currentRegion.path.fillColor;
                            var newPath = currentRegion.path.divide(
                                                prevRegion.path);
                            removeRegion(region);
                            currentRegion.path.remove();
                            currentRegion.path = newPath;
                            var region;
                            var regionId;
                            for( i = 0; i < newPath._children.length; i++ )
                            {
                                if( i == 0 ) {
                                    currentRegion.path = newPath._children[i];
                                }
                                else {
                                    region = newRegion({path:newPath._children[i]});
                                }
                            }
                            currentRegion.path.fillColor = color;
                            if( region ) {
                                region.path.fillColor = prevColor;
                            }
                            updateRegionList();
                            selectRegion(region);
                            paper.view.draw();

//                            commitMouseUndo();
                            backToSelect();
                        }
                    }
                    break;
                }
                if( hitResult == null && currentRegion ) {
                    //deselect paths
                    currentRegion.path.selected = false;
                    currentRegion.path.bringToFront();
                    currentRegion = null;
                    resetAudio();
                }
                break;
            }
            case "draw": {
                // Start a new region
                // if there was an older region selected, unselect it
                if( currentRegion ) {
                    currentRegion.path.selected = false;
                }
                // start a new region
                var path = new paper.Path({segments:[point]})
                path.strokeWidth = config.defaultStrokeWidth;
                var region = newRegion({path:path});
                selectRegion(region);
                // signal that a new region has been created for drawing
                isDrawingRegion = true;

//                commitMouseUndo();
                break;
            }
            case "draw-polygon": {
                // is already drawing a polygon or not?
                if( isDrawingPolygon == false ) {
                    // deselect previously selected region
                    if( currentRegion )
                    currentRegion.path.selected = false;

                    // Start a new Region with alpha 0
                    var path = new paper.Path({segments:[point]})
                    path.strokeWidth = config.defaultStrokeWidth;
                    var region = newRegion({path:path});
                    selectRegion(region);
                    currentRegion.path.fillColor.alpha = 0;
                    currentRegion.path.selected = true;
                    isDrawingPolygon = true;
                    // commitMouseUndo();
                } else {
                    var hitResult = paper.project.hitTest(point, {tolerance:10, segments:true});
                    if(hitResult &&
                       hitResult.item == currentRegion.path &&
                       hitResult.segment.point == currentRegion.path.segments[0].point) {
                        // clicked on first point of current path
                        // --> close path and remove drawing flag
                        finishDrawingPolygon(true);
                    } else {
                        // add point to region
                        currentRegion.path.add(point);
//                        commitMouseUndo();
                    }
                }
                break;
            }
            case "rotate":
            currentRegion.origin = point;
            break;
        }
        paper.view.draw();
    };

    function mouseDrag(x, y, dx, dy) {
        if( config.debug ) console.log("> mouseDrag");

        // transform screen coordinate into world coordinate
        var point = paper.view.viewToProject(new paper.Point(x,y));

        // transform screen delta into world delta
        var orig = paper.view.viewToProject(new paper.Point(0,0));
        var dpoint = paper.view.viewToProject(new paper.Point(dx,dy));
        dpoint.x -= orig.x;
        dpoint.y -= orig.y;

        var region = currentRegion;
        if (!region || (!region.group.kinematic && !currentSlate)) {
            if (currentHandle) {
                toolMessage("Regions that have been segmented cannot be edited.", 2000, 2000);
            }
            return;
        }
        if( currentHandle ) {
            currentHandle.x += point.x-currentHandle.point.x;
            currentHandle.y += point.y-currentHandle.point.y;
            currentHandle.point = point;
//            commitMouseUndo();
        } else if( selectedTool == "draw" ) {
            currentRegion.path.add(point);
        } else if( selectedTool == "select" && !currentSlate ) {
            event.stopHandlers = true;
//            for( var regionId in currentImageInfo.regions ) {
//                var region = currentImageInfo.regions[regionId];
//                if( region.path.selected ) {
//                    region.group.position.x += dpoint.x;
//                    region.group.position.y += dpoint.y;
////                    commitMouseUndo();
//                }
//            }
            region.group.position.x += dpoint.x;
            region.group.position.y += dpoint.y;
        } else if(selectedTool == "rotate") {
            event.stopHandlers = true;
            var degree = parseInt(dpoint.x);
            for( var regionId in currentImageInfo.regions ) {
                if( currentImageInfo.regions[regionId].path.selected ) {
                    currentImageInfo.Regions[regionId].path.rotate(degree, currentRegion.origin);
//                    commitMouseUndo();
                }
            }
        }
        paper.view.draw();
    };
    function mouseUp() {
        if( config.debug ) console.log("> mouseUp");

        if( isDrawingRegion == true ) {
            currentRegion.path.closed = true;
            currentRegion.path.fullySelected = true;
            // to delete all unnecessary segments while preserving the form of the region to make it modifiable; & adding handles to the segments
            var orig_segments = currentRegion.path.segments.length;
            currentRegion.path.simplify(0.001);
            var final_segments = currentRegion.path.segments.length;
            if( config.debug > 2 ) console.log( parseInt(final_segments/orig_segments*100) + "% segments conserved" );
        }
        paper.view.draw();
    };
    function toggleHandles() {
        if(config.debug) console.log("> toggleHandles");
        if (currentRegion != null) {
            if (currentRegion.path.hasHandles()) {
                if (confirm('Do you really want to remove the handles?')) {
                    currentRegion.path.clearHandles();
                }
            } else {
                currentRegion.path.smooth();
            }
            paper.view.draw();
        }
    };


    /************************************************************
        Region Functions
    ************************************************************/
    function initRegionsMenu() {
        /* initializes regions menu */
        if (config.debug) console.log("> initRegionsMenu");

        $("#regionList").click(singlePressOnRegion);
        // $("#regionList").click(doublePressOnRegion);
        // $("#regionList").click(handleRegionTap);
    };

    function styleSelectedRegionInList(regionId) {
        // Select region name in list
        $("#regionList > .region-tag").each(function(i){
            $(this).addClass("deselected");
            $(this).removeClass("selected");
        });
        var tag = $("#regionList > .region-tag#" + regionId);
        $(tag).removeClass("deselected");
        $(tag).addClass("selected");
    };

    function uniqueRegionId() {
        if( config.debug ) console.log("> uniqueRegionId");

        var found = false;
        var counter = 1;
        while( found == false ) {
            found = true;
            for (var regionId in currentImageInfo.regions) {
                if (regionId == counter) {
                    counter++;
                    found = false;
                    break;
                }
            }
        }
        return counter;
    };
    function hash(inputString) {
        /* splits string into array of characters, then applies the function to every element */
        var result = inputString.split("").reduce(function(a,b) {
            // a<<5 bit-shifts a to the left 5 times
            a = ((a<<5)-a) + b.charCodeAt(0);
            // & means bitwise AND
            return a&a;
        }, 0);
        return result;
    };
    function regionHashColor(name) {
        if(config.debug) console.log("> regionHashColor");

        var color = {};
        var h = hash(name);

        // add some randomness
        h = Math.sin(h++)*10000;
        h = 0xffffff*(h-Math.floor(h));

        color.red = h&0xff;
        color.green = (h&0xff00)>>8;
        color.blue = (h&0xff0000)>>16;
        return color;
    };

    function regionTag(regionId) {
        if( config.debug ) console.log("> regionTag");

        var str;
        var color;
        var region = currentImageInfo.regions[regionId];
        if (regionId !== undefined) {
            var mult = 1.0;
            if (region) {
                mult = 255;
                color = region.path.fillColor;
            } else {
                color = regionHashColor(region.name);
            }

            str = "<div class='region-tag' id='"+regionId+"' style='padding:3px 0px 3px'> \
            <img class='eye' title='Region visible' id='eye_"+regionId+"' \
            src='../static/slide/slide_img/eyeOpened.svg' /> \
            <div class='region-color' \
            style='background-color:rgba("+
                parseInt(color.red*mult)+","+parseInt(color.green*mult)+","+parseInt(color.blue*mult)+",0.67)'></div> \
            <span class='region-name'>"+region.name+"</span> \
            <textarea id='desp-"+regionId+"' rows='5' wrap='soft' style='display:none'></textarea></div>"
        }
        return str;
    };
    function changeRegionName(regionId, name) {
        if( config.debug ) console.log("> changeRegionName");

        var region = currentImageInfo.regions[regionId];
        region.name = name;
        paper.view.draw();

        // Update region tag
        $(".region-tag#" + regionId + ">.region-name").text(name);
        setAudio(regionId);
    };

    function toggleRegion(region) {
        if( config.debug ) console.log("> toggleRegion");

        if( region.path.fillColor !== null ) {
            region.path.storeColor = region.path.fillColor;
            region.path.fillColor = null;

            region.path.strokeWidth = 0;
            region.path.fullySelected = false;
            region.group.visible = false;
            region.storeName = region.name;
            $('#eye_' + region.id).attr('src','../static/slide/slide_img/eyeClosed.svg');
        }
        else {
            region.path.fillColor = region.path.storeColor;
            region.path.strokeWidth = 1;
            region.group.visible = true;
            region.name = region.storeName;
            $('#eye_' + region.id).attr('src','../static/slide/slide_img/eyeOpened.svg');
        }
        paper.view.draw();
        $(".region-tag#" + region.id + ">.region-name").text(region.name);
    };

    function updateRegionList() {
        if( config.debug ) console.log("> updateRegionList");

        // remove all entries in the regionList
        $("#regionList > .region-tag").each(function() {
            $(this).remove();
        });

        //var def = $.Deferred();
        for (var regionId in currentImageInfo.regions) {
            var region = currentImageInfo.regions[regionId];
            if( config.debug ) console.log("> restoring region..", regionId);
            $("#regionList").append($(regionTag(regionId)));

            // add the transcript
            if(region.transcript!=undefined || region.transcript!="undefined")
            {
                $("#desp-"+regionId).val(region.transcript);
            }
        }
        //return def.promise();
    };

    function checkRegionSize(regionId) {
        var region = currentImageInfo.regions[regionId];
        if( currentImageInfo.regions[regionId].path.length > 3 ) {
            selectRegion(region);
        }
        else {
            removeRegion(region);
        }
    };

    function clearRegions() {
        if (currentImageInfo &&
            paper.projects[currentImageInfo.projectID]) {
            paper.projects[currentImageInfo.projectID].activeLayer.visible = false;
            $(paper.projects[currentImageInfo.projectID].view.element).hide();
        }
    };

    function simplifyRegion(region) {
        /* calls simplify method of region path to resample the contour */
        if( config.debug ) console.log("> simplifyRegion");

        // if region not provided, default to currentSlate or currentRegion
        if (!region) {
            var region;
            if (currentSlate !== null) {
                region = currentSlate;
            } else if (currentRegion !== null) {
                if (!currentRegion.group.kinematic) {
                    toolMessage("Regions that have been segmented cannot be simplified.", 2000, 2000);
                    return;
                }
                region = currentRegion.path;
            }
        } else if (region.path) {
            region = region.path;
        }

        var length_orig = region.segments.length;

        region.simplify(0.001);

        var length_final = region.segments.length;
        if (config.debug) console.log(parseInt(length_final/length_orig*100) + "% of original points");
        paper.view.draw();
    };
    function complexifyRegion(region) {
        /* calls simplify method of region path to resample the contour */
        if( config.debug ) console.log("> complexifyRegion");

        // if region not provided, default to currentSlate or currentRegion
        if (!region) {
            var region;
            if (currentSlate !== null) {
                region = currentSlate;
            } else if (currentRegion !== null) {
                if (!currentRegion.group.kinematic) {
                    toolMessage("Regions that have been segmented cannot be complexified.", 2000, 2000);
                    return;
                }
                region = currentRegion.path;
            }
        } else if (region.path) {
            region = region.path;
        }

        var length_orig = region.segments.length;

        region.flatten(0.25);
        region.smooth({type: 'continuous'});

        var length_final = region.segments.length;
        if (config.debug) console.log(parseInt(length_final/length_orig*100) + "% of original points");
        paper.view.draw();
    };

    function flipRegion() {
        /* flip region along y-axis around its center point */
        if( config.debug ) console.log("> flipRegion");
        if( currentRegion !== null ) {
            currentRegion.path.scale(-1, 1);
            paper.view.draw();
        }
    };

    function selectRegion(path) {
        // $('regionStatus').html();

        /* In mouseDown this receives the hitResult.item returned by hitTest, not a region */
        if( config.debug ) console.log("> selectRegion");

        paper.project.deselectAll();

        if (!path) {
            setAudio("");
            highlightRegion("");
            return;
        }

        if (currentRegion && currentRegion.slates.length > 0) {
            currentRegion.path.bringToFront();
        }
        if (path.owner && path.id != path.owner.path.id) {
            // selected slate path
            var regionId = path.owner.id;
            currentRegionId = regionId;
            currentRegion = currentImageInfo.regions[regionId];
            currentSlate = path;
            path.selected = true;
            path.fullySelected = true;
        } else if (path.owner) {
            // selected region path
            var regionId = path.owner.id;
            currentRegionId = regionId;
            currentRegion = currentImageInfo.regions[regionId];
            currentSlate = null;
            currentRegion.path.selected = true;
            currentRegion.path.fullySelected = true;

        } else {
            // selected whole region
            var regionId = path.id;
            currentRegionId = regionId;
            currentRegion = currentImageInfo.regions[regionId];
            currentSlate = null;
            currentRegion.path.selected = true;
            currentRegion.path.fullySelected = true;
        }

        for (var i in currentImageInfo.regions) {
            if (currentImageInfo.regions[i] != currentRegion) {
                $("#desp-"+i).hide();
            }
        }
        currentRegion.path.sendToBack();
        $("#desp-"+regionId).show();
        setAudio(regionId);
        highlightRegion(regionId);
        paper.view.draw();

        styleSelectedRegionInList(regionId);
    };


    /************************************************************
        Annotate Operation
    ************************************************************/



    /************************************************************
        Shortcut Handler
    ************************************************************/



    function shortCutHandler(key, callback) {
        var key = config.isMac ? key.mac : key.pc;
        var arr = key.split(" ");
        for (var i = 0; i < arr.length; i++) {
            if( arr[i].charAt(0) == "#" ) {
                arr[i] = String.fromCharCode(parseInt(arr[i].substring(1)));
            } else if (arr[i].length == 1) {
                arr[i] = arr[i].toUpperCase();
            }
        }
        key = arr.join(" ");
        shortcuts[key] = callback;
    };


    /************************************************************
        Utitlity Functions
    ************************************************************/

    function padZerosToString(number, length) {
        /* add leading zeros to (string)number */
        var str = '' + number;
        while( str.length < length ) {str = '0' + str;}
        return str;
    };

    function getHexColor(region) {
        return '#' +
            padZerosToString((parseInt(region.path.fillColor.red * 255))
                                  .toString(16),2) +
            padZerosToString((parseInt(region.path.fillColor.green * 255))
                                  .toString(16),2) +
            padZerosToString((parseInt(region.path.fillColor.blue * 255))
                                  .toString(16),2);
    };

    function randomRgbColor(opacity){
        return new paper.Color(Math.random(),
                               Math.random(),
                               Math.random(),
                               opacity);
    }

    function CellRgbColor(val, opacity){
        if (val == 1.0)
            return new paper.Color(1.0, 0.0, 0.0, opacity);
        else if (val == 2.0)
            return new paper.Color(0.0, 1.0, 0.0, opacity);
        else if (val == 3.0)
            return new paper.Color(0.0, 0.0, 1.0, opacity);
        else
            return new paper.Color(Math.random(), Math.random(), Math.random(), opacity);
    }

    function CellStrokeColor(color){
        if (color == 1.0)
            return 'green';
        else if (color == 2.0)
            return 'blue';
        else if (color == 3.0)
            return 'red';
        else
            return 'black';
    }

    function transformViewport() {
        if (viewer == undefined) {
            // console.log('viewer is undefined!!!!!!!!!!');
            return;
        }

        if (config.debug) console.log("> transformViewport");
        var z = viewer.viewport.viewportToImageZoom(viewer.viewport.getZoom(true));
        var sw = viewer.source.width;
        var bounds = viewer.viewport.getBounds(true);
        var x = magicV * bounds.x;
        var y = magicV * bounds.y;
        var w = magicV * bounds.width;
        var h = magicV * bounds.height;
        paper.view.setCenter(x + w / 2, y + h / 2);
        paper.view.zoom=(sw * z) / magicV;
    };

    function encode64alt(buffer) {
        var binary = '',
        bytes = new Uint8Array( buffer ),
        len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
            binary += String.fromCharCode( bytes[ i ] );
        }
        return window.btoa( binary );
    };

    function convertRegionUnitsToPixels(value, power) {
        /*Multiplies VALUE by a conversion factor POWER times*/
        power = (typeof power !== 'undefined') ?  power : 1;
        if (!Number.isInteger(power)) {
            throw "Power must be an integer.";
        }

        var conversion = 100;
        while (power > 0) {
            value = value*conversion;
            power -= 1;
        }
        return value;
    }

    function convertPixelsToRegionUnits(value, power) {
        /*Divides VALUE by a conversion factor POWER times*/
        power = (typeof power !== 'undefined') ?  power : 1;
        if (!Number.isInteger(power)) {
            throw "Power must be an integer.";
        }

        var conversion = 100;
        while (power > 0) {
            value = value/conversion;
            power -= 1;
        }
        return value;
    }

    function styleSlate(slate, props) {
        props = props ? props : {};

        slate.fillColor = props.fillColor ? props.fillColor : randomRgbColor(config.defaultSlateAlpha);
        slate.strokeWidth = props.strokeWidth ? props.strokeWidth : config.defaultStrokeWidth;
        slate.strokeColor = props.strokeColor ? props.strokeColor : config.defaultStrokeColor;
        slate.strokeScaling = false;
        return slate;
    }

    function CellstyleSlate(slate, props) {

        // slate.fillColor = CellRgbColor(props.fillColor, config.defaultSlateAlpha);
        slate.strokeWidth = 5;
        slate.strokeColor = CellStrokeColor(props.color)
        slate.strokeScaling = false;
        return slate;
    }

    function newCellSlate(contours, pred, region) {
        /* called whenever a new region is created */
        if( config.debug ) console.log("> newSlates");

        // define region properties
        if (!region) {
            var region = currentRegion;
        }

        var regionSlates = new Array(contours.length);
        for (var i = 0; i < contours.length; i++) {
            var newSlate = new paper.Path({segments: contours[i]});
            var props = {
                color : pred[i]
            };
            newSlate = CellstyleSlate(newSlate, props);
            newSlate.simplify(0.001);
            newSlate.owner = region;
            newSlate.closed = true;
            regionSlates[i] = newSlate;
            region.group.addChild(regionSlates[i]);
        }
        region.group.kinematic = false;
        region.slates = regionSlates;
        if (region.path.id == currentRegion.path.id) {
            region.path.sendToBack();
        } else {
            region.path.bringToFront();
        }

        paper.view.draw();

        return region;
    }

    // function newSlates(contours, region) {
    //     /* called whenever a new region is created */
    //     if( config.debug ) console.log("> newSlates");
    //
    //     // define region properties
    //     if (!region) {
    //         var region = currentRegion;
    //     }
    //
    //     var regionSlates = new Array(contours.length);
    //     for (var i = 0; i < contours.length; i++) {
    //         var newSlate = new paper.Path({segments: contours[i]});
    //         newSlate = styleSlate(newSlate);
    //         newSlate.simplify(0.001);
    //         newSlate.owner = region;
    //         newSlate.closed = true;
    //         regionSlates[i] = newSlate;
    //         region.group.addChild(regionSlates[i]);
    //     }
    //     region.group.kinematic = false;
    //     region.slates = regionSlates;
    //     if (region.path.id == currentRegion.path.id) {
    //         region.path.sendToBack();
    //     } else {
    //         region.path.bringToFront();
    //     }
    //
    //     paper.view.draw();
    //
    //     return region;
    // };

    /****************************************************************
        REGIONS
    ****************************************************************/
    function newRegion(arg, imageNumber) {
        /* called whenever a new region is created */
         if( config.debug ) console.log("> newRegion");

        // define region properties
        var region = {};
        if (arg.regionId) {
            var regionId = arg.regionId;
        } else {
            var regionId = uniqueRegionId();
        }
        region.id = regionId;
        if( arg.name ) {
            region.name = arg.name;
        } else {
            // region.name = "region " + regionId;
            region.name = "区域 " + regionId;
        }
        if( arg.description ) {
            region.description = arg.description;
        }
        if( arg.foldername ) {
            region.foldername = arg.foldername;
        }
        if (arg.transcript) {
            region.transcript = arg.transcript;
        } else {
            region.transcript="";
        }

        // region path and its styles
        var color = regionHashColor(region.name);
        if( arg.path ) {
            region.path = arg.path;
            if (!arg.path.strokeWidth) {
                region.path.strokeWidth = config.defaultStrokeWidth;
            }
            if (!region.path.strokeColor) {
                region.path.strokeColor = config.defaultStrokeColor;
            }
            if (!region.path.fillColor) {
                region.path.fillColor = 'rgba('+color.red+','+color.green+','+color.blue+','+config.defaultFillAlpha+')';
            }
            region.path.strokeScaling = false;
            region.path.selected = false;
            region.path.owner = region;
        }

        // slate paths and their styles
        if (arg.slates && arg.slates.constructor === Array && arg.slates.length > 0) {
            region.slates = arg.slates;
            for (i = 0; i < region.slates.length; i++) {
                region.slates[i] = styleSlate(region.slates[i]);
                region.slates[i].owner = region;
                region.slates[i].selected = false;
            }
        } else {
            region.slates = [];
        }

        // groups region path and its slates together
        region.group = new paper.Group();
        region.group.addChild(region.path);
        for (var i = 0; i < region.slates.length; i++) {
            region.group.addChild(region.slates[i]);
        }
        region.group.kinematic = region.group.children.length > 1 ? false : true;
        region.group.owner = region;
        region.path.bringToFront();

        // public path to audio sources
        region.audio = '../../../static/DeepInformaticsAI/Annotations/' + currentDatasetInfo.folder +'/' + currentImageInfo.name+'/'+'region'+regionId+'.mp3';
        // removeRegionAudio(region);

        // push the new region to the Regions array
        currentImageInfo.regions[regionId] = region;
        currentImageInfo.nRegions++;

        if( imageNumber === undefined ) {
            imageNumber = currentImage;
        }

        if( imageNumber === currentImage ) {
            // append region tag to regionList
            $("#regionList").append($(regionTag(regionId)));
        }
        styleSelectedRegionInList(regionId);

        return region;
    };



    function removeRegion(region) {
        if( config.debug ) console.log("> removeRegion");
        // if slate
        if (region.owner) {
            var paperId = region.id;
            var slatesList = region.owner.slates;
            for (var i = 0; i < slatesList.length; i++) {
                if (slatesList[i].id == paperId) {
                    slatesList[i].remove();
                    slatesList.splice(i, 1);
                    paper.view.draw();
                    return true;
                }
            }
        } else {
            region.path.remove();
            var slatesList = region.slates;
            for (var i = 0; i < slatesList.length; i++) {
                slatesList[i].remove();
            }
            delete currentImageInfo.regions[region.id]
            var	tag = $("#regionList > .region-tag#" + region.id);
            $(tag).remove();
            resetAudio();
            removeRegionAudio(region);
        }

        paper.view.draw();
        return true;
    };

    function removeRegionAudio(region) {
        $.ajax({
            type: 'POST',
            url: '/slide/remove_audio',
            data: {
                'img_name': currentImageInfo.name,
                'dataset': currentDatasetInfo.folder,
                'audio_path': region.audio,
            },
            success: function(obj) {
                if (config.debug) {
                    console.log("> remove audio " + obj['status']);
                  }
            }
        });
    };


    /************************************************************
        ImageInfo Getter
    ************************************************************/

    function getImageInfo() {
        return imageInfo;
    };

    function getConfig() {
        return config;
    };

    function getCurrentImage() {
        return currentImage;
    };

    function getCurrentImageInfo() {
        return currentImageInfo;
    };

    function getCurrentRegion() {
        return currentRegion;
    };


    function getCurrentDataset() {
        return currentDataset;
    };
    function getCurrentDatasetInfo() {
        return currentDatasetInfo;
    };


    /************************************************************
        AUDIO
    ************************************************************/
    function setAudio(regionId) {
        if (config.debug) console.log("> setAudio");
        var region = currentImageInfo.regions[regionId];
        if (region) {
            // if (region.audio != null) {
            console.log("> Region audio: " + region.audio);

            if (util.srcExists(region.audio) == true) {
                var d = new Date();
                $("#menuAudioPlayer").attr("src", region.audio + '?' + d.getTime());

                if (config.debug) console.log("> Force refresh audio source");
            } else {
                // $("#menuAudioPlayer").removeAttr("src");
                var init_contents = "data:audio/mp3;base64,";
                var d = new Date();
                $("#menuAudioPlayer").attr("src", init_contents + '?' + d.getTime());
                if (config.debug) console.log("> Remove src");
            }
            // $("#menuAudioPlayer").attr("src", region.audio + '?' + d.getTime());
            // if (config.debug) console.log("> Force refresh audio source");

            $("#audioPanel").removeClass("inactive");
            $("#region-msg").html(region.name);

        } else {
            resetAudio();
        }
    };

    function resetAudio() {
        if (config.debug) console.log("> resetAudio");
        //$("#menuAudioPlayer").removeAttr("src");

        var init_contents = "data:audio/mp3;base64,";
        var d = new Date();
        $("#menuAudioPlayer").attr("src", init_contents + '?' + d.getTime());

        $("#region-msg").html("请选择区域");
        $("#audioPanel").addClass("inactive");
    };

    function startRecording(button) {
        if (config.debug) console.log("> startRecording");
        if (!currentRegion) {
            return;
        }
        slideAudio.startRecording();
        button.disabled = true;
        button.nextElementSibling.disabled = false;
        $(button).hide();
        $(button).parent().prev().html('录音中......').fadeIn();
        $(button.nextElementSibling).show();

        var recordingslist = $(button).parent().next().children();
        recordingslist.empty();
    };

    function stopRecording(button) {
        if (config.debug) console.log("> stopRecording");
        slideAudio.stopRecording();

        button.disabled = true;
        button.previousElementSibling.disabled = false;
        $(button).hide();
        $(button.previousElementSibling).show();
        // $(button).parent().prev().fadeOut();
    };

    /************************************************************
        HTML Element operation
    ************************************************************/
    function toolMessage(text, timeDisplayed, timeFadeout) {
        if (toolMessageUp) {
            return;
        }
        toolMessageUp = true;
        $('#toolDialog').html(text).fadeIn();
        setTimeout(function() {
            $("#toolDialog").fadeOut(timeDisplayed);
            toolMessageUp = false;}, timeFadeout);
    }

    function saveMessage(text, timeDisplayed, timeFadeout) {
        console.log("In save message: " + text);
        $('#saveDialog').html(text).fadeIn();
        setTimeout(function() {$("#saveDialog").fadeOut(timeDisplayed);}, timeFadeout);
    }

    function collapseMenu() {
        /* hides or displays menu bar */
        if (config.debug) console.log("> collapseMenu");
        console.log($('#menuPanel').css('display'));

        if ($('#menuPanel').css('display') == 'none') {
            $('#menuPanel').css('display', 'block');
            $('#menuButton').css('display', 'none');
        } else {
            $('#menuPanel').css('display', 'none');
            $('#menuButton').css('display', 'block');
        }
    };

    function toggleMenu() {
        /* hides or displays menu bar */
        if (config.debug) console.log("> toggleMenu");

        if ($('#menuRegion').css('display') == 'none') {
            $('#menuRegion').css('display', 'block');
            // $('#menuFilmstrip').css('display', 'none');
        } else {
            $('#menuRegion').css('display', 'none');
            // $('#menuFilmstrip').css('display', 'block');
        }
    };





    /************************************************************
        Operation configuration and shortcuts
    ************************************************************/
    function configTools() {
        // Enable click on toolbar buttons
        $("img.button").click(toolSelectionHandler);
        // Configure currently selected tool
        setSelectedTool("navigator");

        // Initialize the control key handler and set shortcuts
        initShortCutHandler();
        // shortCutHandler({pc:'^ z',mac:'cmd z'}, cmdUndo);
        // shortCutHandler({pc:'^ y',mac:'cmd y'}, cmdRedo);
        if (config.isDrawingEnabled ) {
            shortCutHandler({pc:'^ x',mac:'cmd x'}, function() { if (config.debug) console.log("cut!")});
            shortCutHandler({pc:'^ v',mac:'cmd v'}, cmdPaste);
            shortCutHandler({pc:'^ a',mac:'cmd a'}, function() { if (config.debug) console.log("select all!")});
            shortCutHandler({pc:'^ c',mac:'cmd c'}, cmdCopy);

        }

        shortCutHandler({pc:'#46',mac:'#8'}, cmdDeleteSelected);  // delete key
        shortCutHandler({pc:'#37',mac:'#37'}, loadPreviousImage); // left-arrow key
        shortCutHandler({pc:'#39',mac:'#39'}, loadNextImage);     // right-arrow key

    };


    // tool selection handler
    function toolSelectionHandler(event) {
        if( config.debug ) console.log("> toolSelectionHandler");

        //end drawing of polygons and make open form
        if (isDrawingPolygon == true) {
            finishDrawingPolygon(true);
        }

        setSelectedTool($(this).attr("id"));
        switch(selectedTool) {
            case "select":
            case "addpoint":
            case "delpoint":
            case "addregion":
            case "delregion":
            case "draw":
            case "rotate":
            case "draw-polygon":
                navEnabled = false;
                break;
            case "navigator":
                navEnabled = true;
                currentHandle = null;
                break;
            case "delete":
                cmdDeleteSelected();
                backToPreviousTool();
                break;
            case "save":
                microdrawDBSave();
                backToPreviousTool();
                break;
            case "zoom-in":
            case "zoom-out":
            case "home":
                backToPreviousTool();
                break;
            case "prev":
                loadPreviousImage();
                backToPreviousTool();
                break;
            case "next":
                loadNextImage();
                backToPreviousTool();
                break;
            case "copy":
                cmdCopy();
                backToSelect();
                break;
            case "paste":
                cmdPaste();
                backToSelect();
                break;
            case "simplify":
                simplifyRegion();
                backToSelect();
                break;
            case "complexify":
                complexifyRegion();
                backToSelect();
                break;
            case "flip":
                flipRegion();
                backToSelect();
                break;
            case "closeMenu":
                collapseMenu();
                backToPreviousTool();
                break;
            case "openMenu":
                collapseMenu();
                backToPreviousTool();
                break;
            case "toggleMenu":
                toggleMenu();
                backToPreviousTool();
                break;
            case "handle":
                toggleHandles();
                backToPreviousTool();
                break;
            case "segment":
                segmentRegion();
                backToPreviousTool();
                break;
            case "Ki67":
                Ki67Calculate();
                backToPreviousTool();
                break;
            case "ER":
                erCalculate();
                backToPreviousTool();
                break;
            case "PR":
                prCalculate();
                backToPreviousTool();
                break;
        }
    };

    // select tool and highlight
    function setSelectedTool(toolname) {
        if( config.debug ) console.log("> selectTool");

        prevTool = selectedTool;
        selectedTool = toolname;
        $("img.button").removeClass("selected");
        $("img.button#" + selectedTool).addClass("selected");
    };

    function initShortCutHandler() {
        $(document).keydown(function(e) {
            var key = [];
            if( e.ctrlKey ) key.push("^");
            if( e.altKey ) key.push("alt");
            if( e.shiftKey ) key.push("shift");
            if( e.metaKey ) key.push("cmd");
            key.push(String.fromCharCode(e.keyCode));
            key = key.join(" ");
            if( shortcuts[key] ) {
                var callback = shortcuts[key];
                callback();
                if(!$(document.activeElement).is('textarea'))
                    e.preventDefault();
            }
        });
    };

    function cmdPaste() {
        if(copyRegion !== null) {
            console.log( "paste " + copyRegion.name );
            if (copyRegion.name) {
                copyRegion.name += " (Copy)";
            }
            var reg = JSON.parse(JSON.stringify(copyRegion));
            region.path = new paper.Path();
            region.path.importJSON(copyRegion.path);
            region.path.fullySelected = true;
            var color = regionHashColor(region.name);
            reg.path.fillColor = 'rgba(' + color.red + ',' + color.green + ',' + color.blue + ',0.5)';
            newRegion({name: copyRegion.name, path: region.path});
        }
        paper.view.draw();
    };

    function cmdCopy() {
        if (currentRegion !== null) {
            var json = currentRegion.path.exportJSON();
            copyRegion = JSON.parse(JSON.stringify(currentRegion));
            copyRegion.path = json;
            console.log( "< copy " + copyRegion.name );
        }
    };

    function cmdDeleteSelected() {
        if($(document.activeElement).is('textarea')) return;

        if (currentSlate) {
            removeRegion(currentSlate);
            currentSlate = null;
        } else {
            removeRegion(currentRegion);
            currentRegion = null;
        }
    };

    function Ki67Calculate() {
        // verify a region is selected
        if (!currentRegion) {
            toolMessage("A region must be selected to perform segmentation.", 2000, 2000);
            return;
        }
        var region = currentRegion; // in case new region is selected during runtime

        // console.log("Current image");
        // console.log(currentImageInfo.fullpath);

        // Get all points information
        // var region_path = currentRegion.path.clone({insert: false});

        var region_path = currentRegion.path;
        var contour_points=[];
        // 2017.7.7 moodify cycle through points on region, converting to image coordinates
        for (var i = 0; i < region_path.segments.length; i++) {
            var point = paper.view.projectToView(region_path.segments[i].point);
            var x = imagingHelper.physicalToDataX(point.x);
            var y = imagingHelper.physicalToDataY(point.y);
            contour_points.push(JSON.stringify({"x": x, "y": y}));
        }



        $.ajax({
            type: 'POST',
            url: '/slide/ki67_cal',
            data: {
                'slide_path': currentImageInfo.fullpath,
                'contour_points': contour_points,
            },
            success: function(obj) {
                    // console.log("> Ki67 information ");
                    var response = $.parseJSON(obj);
                    if (response['Ki67'] === "error") {
                        alert("Ki67 calcuation error");
                    }

                    if (response['Ki67'] === "SizeError") {
                        alert("当前区域太大，请放大到最大倍率选择区域");
                    }
                    else {
                        currentRegion['Ki67'] = response['Ki67'];
                        // console.log("Current region's ki67 index is ");
                        // console.log(currentRegion['Ki67']);

                        // Calculate average Ki67 value
                        var ki67_list = [];
                        var ki67_sum = 0.0;
                        var num_ki67 = 0;

                        for( var regionId in currentImageInfo.regions ) {
                            // console.log("Region is ", regionId);
                            // console.log("Ki67 vale is  ", currentImageInfo.regions[regionId]['Ki67']);
                            if (currentImageInfo.regions[regionId]["Ki67"] !== undefined){
                                var cur_ki67 = parseFloat(currentImageInfo.regions[regionId]['Ki67']);
                                ki67_list.push(cur_ki67);
                                ki67_sum += cur_ki67;
                                num_ki67 += 1;

                            }
                        }
                        // console.log("List of Ki67: ", cur_ki67);
                        // console.log("Ki67 sum is: ", ki67_sum);
                        // console.log("Num of ki67: ", num_ki67);
                        var avg_ki67_val = parseFloat(ki67_sum/num_ki67).toFixed(1);
                        // console.log("Mean of all reigons is ", avg_ki67_val);




                        textareaMessage = ''
                        message = "<p><strong>迪英加智能诊断为您判读</strong></p>";
                        message += "<p>当前区域Ki67指数: " + response['Ki67'] + "&#37;" + "</p><p>";
                        // console.log(parseFloat(response['Ki67']));
                        message += "<p>平均Ki67指数: " + String(avg_ki67_val) + "&#37;" + "</p><p>";
                        if ( avg_ki67_val > 20.0 ) {
                            message += "Ki67等级为G3，建议化疗。";
                            textareaMessage = "Ki67等级为G3，建议化疗。";
                        }
                        else if ( 3.0 < avg_ki67_val ) {
                            message += "Ki67等级为G2，不建议化疗。";
                            textareaMessage = "Ki67等级为G2，不建议化疗。";
                        }
                        else {
                            message += "Ki67等级为G1，不建议化疗。";
                            textareaMessage = "Ki67等级为G1，不建议化疗。";
                        }
                        message += "</p>";

                        saveMessage(message, 500, 8000);

                        // console.log(region.id);
                        $("#desp-"+region.id).html("当前区域Ki67指数: " + response['Ki67'] + "%\n" + "平均Ki67指数:" + String(avg_ki67_val) +  "%\n"+ textareaMessage);


                        if (region.slates && region.slates.length > 0) {
                            while (region.slates.length > 0) {
                                removeRegion(region.slates[0]);
                            }
                        }

                        var contours = new Array(response['contours'].length);
                        for (var i = 0; i < response['contours'].length; i++) {
                            contours[i] = new Array(response['contours'][i].length);
                            for (var j = 0; j < response['contours'][i].length; j++) {
                                var x = convertPixelsToRegionUnits(response['contours'][i][j][0]);
                                var y = convertPixelsToRegionUnits(response['contours'][i][j][1]);
                                contours[i][j] = [x, y];
                                // contours[i][j] = [response['contours'][i][j][0], response['contours'][i][j][1]];
                            }
                        }
                        // newSlates(contours, region);
                        // console.log('region is :    ');
                        // console.log(region);
                        region.slates = null;
                        newCellSlate(contours, response['preds'], region);
                    }
            }
        });
    };

    function erCalculate() {
         // verify a region is selected
        if (!currentRegion) {
            toolMessage("A region must be selected to perform segmentation.", 2000, 2000);
            return;
        }
        var region = currentRegion; // in case new region is selected during runtime

        var region_path = currentRegion.path;
        var contour_points=[];
        // 2017.7.7 moodify cycle through points on region, converting to image coordinates
        for (var i = 0; i < region_path.segments.length; i++) {
            var point = paper.view.projectToView(region_path.segments[i].point);
            var x = imagingHelper.physicalToDataX(point.x);
            var y = imagingHelper.physicalToDataY(point.y);
            contour_points.push(JSON.stringify({"x": x, "y": y}));
        }


        $.ajax({
            type: 'POST',
            url: '/slide/er_cal',
            data: {
                'slide_path': currentImageInfo.fullpath,
                'contour_points': contour_points,
            },
            success: function(obj) {

                    // console.log("> Ki67 information ");
                    var response = $.parseJSON(obj);
                    if (response['ER'] === "error") {
                        alert("ER calcuation error");
                    }

                    if (response['ER'] === "SizeError") {
                        alert("当前区域太大，请放大到最大倍率选择区域");
                    }
                    else {
                        currentRegion['ER'] = response['ER'];
                        // console.log("Current region's ki67 index is ");
                        // console.log(currentRegion['Ki67']);

                        // Calculate average Ki67 value
                        var er_list = [];
                        var er_sum = 0.0;
                        var num_er = 0.0;

                        for( var regionId in currentImageInfo.regions ) {
                            // console.log("Region is ", regionId);
                            // console.log("Ki67 vale is  ", currentImageInfo.regions[regionId]['Ki67']);
                            if (currentImageInfo.regions[regionId]["ER"] !== undefined){
                                var cur_er = parseFloat(currentImageInfo.regions[regionId]['ER']);
                                er_list.push(cur_er);
                                er_sum += cur_er;
                                num_er += 1;

                            }
                        }
                        console.log("List of Ki67: ", cur_er);
                        console.log("Ki67 sum is: ", er_sum);
                        console.log("Num of ki67: ", num_er );
                        var avg_er_val = parseFloat(er_sum/num_er).toFixed(1);
                        // console.log("Mean of all reigons is ", avg_ki67_val);




                        textareaMessage = ''
                        message = "<p><strong>迪英加智能诊断为您判读</strong></p>";
                        message += "<p>当前区域ER指数: " + response['ER'] + "&#37;" + "</p><p>";
                        // console.log(parseFloat(response['Ki67']));
                        message += "<p>平均ER指数: " + String(avg_er_val) + "&#37;" + "</p><p>";
                        // if ( avg_ki67_val > 20.0 ) {
                        //     message += "Ki67等级为G3，建议化疗。";
                        //     textareaMessage = "Ki67等级为G3，建议化疗。";
                        // }
                        // else if ( 3.0 < avg_ki67_val ) {
                        //     message += "Ki67等级为G2，不建议化疗。";
                        //     textareaMessage = "Ki67等级为G2，不建议化疗。";
                        // }
                        // else {
                        //     message += "Ki67等级为G1，不建议化疗。";
                        //     textareaMessage = "Ki67等级为G1，不建议化疗。";
                        // }
                        message += "</p>";

                        saveMessage(message, 500, 8000);

                        // console.log(region.id);
                        $("#desp-"+region.id).html("当前区域ER指数: " + response['ER'] + "%\n" + "平均ER指数:" + String(avg_er_val) +  "%\n"+ textareaMessage);


                        if (region.slates && region.slates.length > 0) {
                            while (region.slates.length > 0) {
                                removeRegion(region.slates[0]);
                            }
                        }

                        var contours = new Array(response['contours'].length);
                        for (var i = 0; i < response['contours'].length; i++) {
                            contours[i] = new Array(response['contours'][i].length);
                            for (var j = 0; j < response['contours'][i].length; j++) {
                                var x = convertPixelsToRegionUnits(response['contours'][i][j][0]);
                                var y = convertPixelsToRegionUnits(response['contours'][i][j][1]);
                                contours[i][j] = [x, y];
                                // contours[i][j] = [response['contours'][i][j][0], response['contours'][i][j][1]];
                            }
                        }
                        // newSlates(contours, region);
                        // console.log('region is :    ');
                        // console.log(region);
                        region.slates = null;
                        newCellSlate(contours, response['preds'], region);
                    }
            }
        });



    };

    function prCalculate() {
         // verify a region is selected
        if (!currentRegion) {
            toolMessage("A region must be selected to perform segmentation.", 2000, 2000);
            return;
        }
        var region = currentRegion; // in case new region is selected during runtime

        var region_path = currentRegion.path;
        var contour_points=[];
        // 2017.7.7 moodify cycle through points on region, converting to image coordinates
        for (var i = 0; i < region_path.segments.length; i++) {
            var point = paper.view.projectToView(region_path.segments[i].point);
            var x = imagingHelper.physicalToDataX(point.x);
            var y = imagingHelper.physicalToDataY(point.y);
            contour_points.push(JSON.stringify({"x": x, "y": y}));
        }


        $.ajax({
            type: 'POST',
            url: '/slide/pr_cal',
            data: {
                'slide_path': currentImageInfo.fullpath,
                'contour_points': contour_points,
            },
            success: function(obj) {

                    // console.log("> Ki67 information ");
                    var response = $.parseJSON(obj);
                    if (response['PR'] === "error") {
                        alert("PR calcuation error");
                    }

                    if (response['PR'] === "SizeError") {
                        alert("当前区域太大，请放大到最大倍率选择区域");
                    }
                    else {
                        currentRegion['PR'] = response['PR'];
                        console.log("PR value of current region is ", currentRegion['PR']);
                        // console.log("Current region's ki67 index is ");
                        // console.log(currentRegion['Ki67']);

                        // Calculate average Ki67 value
                        var pr_list = [];
                        var pr_sum = 0.0;
                        var num_pr = 0;

                        for( var regionId in currentImageInfo.regions ) {
                            // console.log("Region is ", regionId);
                            // console.log("Ki67 vale is  ", currentImageInfo.regions[regionId]['Ki67']);
                            if (currentImageInfo.regions[regionId]["PR"] !== undefined){
                                var cur_pr = parseFloat(currentImageInfo.regions[regionId]['PR']);
                                console.log("Region id " + String(regionId) +  " pr value " + String(cur_pr))
                                pr_list.push(cur_pr);
                                pr_sum += cur_pr;
                                num_pr += 1;

                            }
                        }
                        console.log("List of Ki67: ", cur_pr);
                        console.log("Ki67 sum is: ", pr_sum);
                        console.log("Num of ki67: ", num_pr);
                        var avg_pr_val = parseFloat(pr_sum/num_pr).toFixed(1);
                        // console.log("Mean of all reigons is ", avg_ki67_val);




                        textareaMessage = ''
                        message = "<p><strong>迪英加智能诊断为您判读</strong></p>";
                        message += "<p>当前区域PR指数: " + response['PR'] + "&#37;" + "</p><p>";
                        // console.log(parseFloat(response['Ki67']));
                        message += "<p>平均PR指数: " + String(avg_pr_val) + "&#37;" + "</p><p>";
                        // if ( avg_ki67_val > 20.0 ) {
                        //     message += "Ki67等级为G3，建议化疗。";
                        //     textareaMessage = "Ki67等级为G3，建议化疗。";
                        // }
                        // else if ( 3.0 < avg_ki67_val ) {
                        //     message += "Ki67等级为G2，不建议化疗。";
                        //     textareaMessage = "Ki67等级为G2，不建议化疗。";
                        // }
                        // else {
                        //     message += "Ki67等级为G1，不建议化疗。";
                        //     textareaMessage = "Ki67等级为G1，不建议化疗。";
                        // }
                        message += "</p>";

                        saveMessage(message, 500, 8000);

                        // console.log(region.id);
                        $("#desp-"+region.id).html("当前区域PR指数: " + response['PR'] + "%\n" + "平均PR指数:" + String(avg_pr_val) +  "%\n"+ textareaMessage);


                        if (region.slates && region.slates.length > 0) {
                            while (region.slates.length > 0) {
                                removeRegion(region.slates[0]);
                            }
                        }

                        var contours = new Array(response['contours'].length);
                        for (var i = 0; i < response['contours'].length; i++) {
                            contours[i] = new Array(response['contours'][i].length);
                            for (var j = 0; j < response['contours'][i].length; j++) {
                                var x = convertPixelsToRegionUnits(response['contours'][i][j][0]);
                                var y = convertPixelsToRegionUnits(response['contours'][i][j][1]);
                                contours[i][j] = [x, y];
                                // contours[i][j] = [response['contours'][i][j][0], response['contours'][i][j][1]];
                            }
                        }
                        // newSlates(contours, region);
                        // console.log('region is :    ');
                        // console.log(region);
                        region.slates = null;
                        newCellSlate(contours, response['preds'], region);
                    }
            }
        });



    };



    return {
        initialize_slideview: initialize_slideview,
        reset_slideview: reset_slideview,
        startRecording: startRecording,
        stopRecording: stopRecording,
        getCurrentImageInfo: getCurrentImageInfo,
        getCurrentDatasetInfo: getCurrentDatasetInfo,
    }

})();
