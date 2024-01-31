var mindData = [];


tinymce.PluginManager.add('mindMap', function (editor, url) {
    
    editor.ui.registry.addToggleButton('editMindMap', {
        icon: 'edit',
        tooltip: 'Upravit myšlenkovou mapu',
        onAction: () => editMindMap()
      });
    
      editor.ui.registry.addContextToolbar('mindMap', {
        predicate: (accordion) =>
          editor.dom.is(accordion, 'img.mindMap'),
        items: 'editMindMap',
        scope: 'node',
        position: 'node'
      });

      var editMindMap = () => {
        showMindMap();
      }
    });

