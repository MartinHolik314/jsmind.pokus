tinymce.PluginManager.add('ailof', function (editor, url) {
    editor.ui.registry.addIcon('bubbles', '<svg width="24" height="24"><use xlink:href="custom-icons.svg#bubbles4"></use></svg>');
    
    var dialog, dialogRoot;
    var rootId = mcf.guid();
    var promptPlaceholder = "Jak můžeme vylepšit vybraný text?";
    var eventHandler = new AbortController();
    var promptEl, btnEl, responseEl, actionButtonsContainerEl;
    var taskRunning;
    var renderActionButtons = false;
    var lastData = "";
    var renderResponse = false;
    var expandedRange;
    var lastPrompt;
    
    var dispose = () => {
        taskRunning = false;
        promptEl = null;
        eventHandler.abort();
        window["lofAiDialog"] = undefined;
        delete window["lofAiDialog"];
        editor.off("SelectionChange", selectionEventHandler);
    };
    
    editor.on("remove", () => {
        dispose();
    });
    
    var onClose = () => {
        promptEl = null;
        taskRunning = false;
        renderActionButtons = false;
        lastData = "";
        renderResponse = false;
        responseEl.classList.remove("renderResponse");
        actionButtonsContainerEl.classList.remove("renderBtns");
        actionButtonsContainerEl.classList.add("hiddenBtns");
    };
    
    var selectionEventHandler = () => {
        var selection = editor.selection.getContent();

        if (promptEl) {
            if (selection.length <= 0) {
                promptEl.placeholder = "Co si přejete do přípravy přidat? Je možné vygenerovat pouze text."
            }
            else {
                promptEl.placeholder = promptPlaceholder;
            }   
        }
    };
    
    var skipUpNodeNames = ["B", "I", "STRIKE", "STRONG", "EM", "U"];
    
    var getParentLogicalNode = (node) => {
        if (node.nodeName !== "#text") {
            return node;
        }
        
        var maxParentsUp = 100;
        
        while (maxParentsUp > 0 && node.parentNode) {
            node = node.parentNode;
            maxParentsUp--;
            
            if (!skipUpNodeNames.includes(node.nodeName)) {
                return node;
            }
        }
        
        return node;
    }
    
    var getRawAndLogicalSelection = () => {
        var selectedText = editor.selection.getContent({format: "text"});
        
        if (selectedText.length <= 0) {
            return {
                selected: "",
                logical: ""
            };
        }
        
        var collapsed = editor.selection.isCollapsed();

        if (collapsed) {
            editor.selection.expand({type: "word"});
        }

        var myRange = editor.selection.normalize();
        var storedRange = myRange.cloneRange();
        var startNode = getParentLogicalNode(myRange.startContainer);
        var endNode = getParentLogicalNode(myRange.endContainer);
        myRange.setStart(startNode, 0);
        myRange.setEnd(endNode, endNode.nodeName === "#text" ? endNode.length : endNode.childNodes.length); // for document = 0, for #text / #comment = text length, else = number of children to include in the selection

        expandedRange = myRange.cloneRange();
        var logicalText = editor.selection.getContent({format: "text"});

        myRange.setStart(storedRange.startContainer, storedRange.startOffset);
        myRange.setEnd(storedRange.endContainer, storedRange.endOffset);
        
        return {
            selected: selectedText,
            logical: logicalText
        };
    }

    window["onPromptSubmit"] = (t = 0.2) => {
        
        if (taskRunning) {
            mcf.toast("info", "Počkejte prosím na dokončení předchozího požadavku");
            return;
        }
        
        dialogRoot.block("Pracujeme na požadavku..");

        document.getElementById(`${rootId}_responsePreview`).innerHTML = "";

        var val = promptEl.value.trim();
        lastPrompt = val;
        
        taskRunning = true;
        promptEl.value = "";
        promptEl.disabled = true;
        btnEl.disabled = true;
        
        if (!promptEl) {
            return;
        }
        
        var ctx = getRawAndLogicalSelection();

        if (val.length <= 0 && ctx.selected.length > 0) {
            mcf.toast("error", "Zadejte prosím, jak můžeme vybraný text vylepšit");
            return;
        }
        
        if (ctx.selected.length > 8000) {
            ctx.selected = ctx.selected.substring(0, 8000);
        }
        
        if (ctx.logical.length > 8000) {
            ctx.logical = ctx.logical.substring(0, 8000);
            mcf.toast("warning", "Označili jste velmi dlouhý text, budeme pracovat pouze s jeho částí. Pro nejlepší výsledky označený text prosím zkraťte.");
        }
        
        if (window["currentJobRef"] && window["currentJobRef"]["invokeMethodAsync"]) {
            window[`currentJobRef`]["invokeMethodAsync"]('ContextInfer', JSON.stringify({
                selection: ctx.logical,
                prompt: val,
                t: t
            }));
            
            window["llmJobApi"]["onChunkArrived"] = (text) => {
                
                dialogRoot.unblock();
                
                if (!renderResponse) {
                    renderResponse = true;
                    responseEl.classList.add("renderResponse");
                }

                lastData = text;
                document.getElementById(`${rootId}_responsePreview`).innerHTML = text;
            };

            window["llmJobApi"]["onStreamFinished"] = () => {
                taskRunning = false;
                promptEl.disabled = false;
                btnEl.disabled = false;
                renderActionButtons = true;
                actionButtonsContainerEl.classList.add("renderBtns");
            };
        }
    };
    
    window["retryPrompt"] = () => {
        promptEl.value = lastPrompt;
        window["onPromptSubmit"](0);
    }
    
    window["acceptSuggestion"] = () => {
        
        var selectedText = editor.selection.getContent({format: "text"}).trim();
        
        if (selectedText.length <= 0) {
            editor.dom.add(editor.getBody(), 'div', {'class' : ''}, lastData);
        }
        else {
            var myRange = editor.selection.normalize();
            myRange.setStart(expandedRange.startContainer, expandedRange.startOffset);
            myRange.setEnd(expandedRange.endContainer, expandedRange.endOffset);

            editor.selection.setContent(lastData);   
        }
        
        lastData = "";
        renderResponse = false;
        responseEl.classList.remove("renderResponse");
        actionButtonsContainerEl.classList.remove("renderBtns");
        actionButtonsContainerEl.classList.add("hiddenBtns");
        dialogRoot.close();

        var event = new Event('rteContentChanged');
        document.dispatchEvent(event);
    }
    
    var afterModalOpen = () => {
        promptEl = document.getElementById(`${rootId}_promptInput`);
        btnEl = document.getElementById(`${rootId}_promptBtn`);
        responseEl = document.getElementById(`${rootId}_responsePreview`);
        actionButtonsContainerEl = document.getElementById(`${rootId}_actionButtons`);
        promptEl.focus();
        selectionEventHandler();
        
        editor.on("SelectionChange", selectionEventHandler);
        
        promptEl.addEventListener("keypress", (evt) => {
             if (evt.key !== "Enter") {
                 return;
             }

            window["onPromptSubmit"]();
        }, { signal: eventHandler.signal });
    };
    
    var dialogCfg = {
        title: "ScioBot",
        body: {
            type: "panel",
            items: [
                {
                    type: "htmlpanel",
                    html: `
                        <div id="${rootId}_responsePreview"></div>
                        <div id="${rootId}_actionButtons" class="btnsBase hiddenBtns">
                            <button class="tox-button" onclick="acceptSuggestion()">Přijmout</button>
                            <button class="tox-button--secondary" onclick="retryPrompt()">Zkusit znovu</button>
                        </div>
                        <div style="display: flex; gap: 4px; width: 100%;">
                            <input id="${rootId}_promptInput" class="tox-textfield" type="text" style="width: 100%;" placeholder="${promptPlaceholder}" />
                            <button id="${rootId}_promptBtn" onclick="onPromptSubmit()" title="Odeslat" type="button" tabindex="-1" data-alloy-tabstop="true" class="tox-button tox-button--icon"><span class="tox-icon tox-tbtn__icon-wrap">
                                <svg width="24" height="24" focusable="false"><path fill-rule="evenodd" clip-rule="evenodd" d="m13.3 22 7-18.3-18.3 7L9 15l4.3 7ZM18 6.8l-.7-.7L9.4 14l.7.7L18 6.8Z"></path></svg></span>
                            </button>
                        </div>
                        <style>
                            .renderResponse {
                                margin-bottom: 1rem !important;
                            }
                            
                            .btnsBase {
                                display: flex;
                                gap: 20px;
                            }
                            
                            .hiddenBtns {
                                display: none;
                            }
                            
                            .renderBtns {
                                 margin-top: -0.5rem !important;
                                 margin-bottom: 0.5rem !important;
                                 display: block;
                            }
                        </style>
                    `
                }
            ]
        },
        buttons: [

        ],
        initialData: {
            prompt: ""
        },
        size: "medium",
        onCancel: () => {
            onClose();
        },
        onClose: () => {
            onClose();
        }
    };
    
    var openModal = () => {
        
        if (promptEl) {
            promptEl.focus();
            return;
        }
        
        dialogRoot = editor.windowManager.open(dialogCfg, { inline: 'bottom', persistent: true });
        window["lofAiDialog"] = dialogRoot;
        afterModalOpen();
        
        if (false) {
            var dialogInst = editor.windowManager.openUrl({
                title: 'AI',
                url: `Editor/Index?id=${window["currentJobId"]}`
            });

            dialog = dialogInst;
            dialog.block("Načítám..");

            window.addEventListener('message', (event) => {

                var data = event.data;

                if (!data.mceAction) {
                    return;
                }

                var action = data.mceAction;

                if (action === "_getDataAndUnblock") {
                    dialog.unblock();
                    sendData("selection", {
                        selectedText: editor.selection.getContent({format: "text"}),
                        selectedHtml: editor.selection.getContent({format: "html"}),
                        contentText: editor.getContent({format: "text"}),
                        contentHtml: editor.getContent({format: "html"}),
                    });
                }
            });   
        }
    }
    
    var sendData = (key = "", data = {}) => {
        if (dialog) {
            data = data || {};
            data.rte = true;
            data.key = key;
            dialog.sendMessage(data);
        }
    }

    editor.ui.registry.addButton('lofai', {
        tooltip: "ScioBot",
        icon: "ai",
        onAction: function () {
            openModal();
        }
    });

    editor.ui.registry.addButton('lofai-prompt', {
        tooltip: "ScioBot",
        icon: "ai-prompt",
        onAction: function () {
            openModal();
        }
    });

    editor.ui.registry.addContextMenu('lofai-menu', {
        update: (element) => {

        }
    });

    return {
        getMetadata: function () {
            return {
                name: "AiLof - Matěj Štágl",
                url: "https://www.linkedin.com/in/mat%C4%9Bj-%C5%A1t%C3%A1gl-85105b208/"
            };
        }
    };
});