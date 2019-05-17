const fileUtils = require('fs')
const DependencyInjection = require('../../../../org/autumnframework/context/DependencyInjection.js')
const LassieLoaderCommon = require('./LassieLoaderCommon.js');
const cheerio = require('cheerio')

function AutoConfigurationModuleCompletion() {

  var _this = this;

  var requireTemplate = `const @dependencyClassName = require('@dependencyLocation');`;
  var instantiateModuleTemplate = `_this.context["@dependencyName"] = new @dependencyClassName();`;
  var injectionTemplate = `_this.context["@dependencyName"].@autowireName = _this.context["@autowireName"];`;
  var fragmentMappingTemplate = `_this.listenersByFragmentUrlId["@fragmentUrlId"] = _this.context["@dependencyName"];`;

  var flashBootApplicationTemplate = `

  import './styles/index.scss'

  function FlashBootApplication() {

    var _this = this;
    _this.context = {};
    _this.listenersByFragmentUrlId = {};

  }

  `;
  var linkStartFunctionTemplate = `

  function linkStart(){
    let flashBootApplication = new FlashBootApplication();
    flashBootApplication.start();
  }

  `;

  var startFunctionTemplate = `
  _this.start = function () {
    @require
    @instantiate
    @injection
    @fragmentListeners

    if(_this.entrypointFragmentUrlId && _this.listenersByFragmentUrlId[_this.entrypointFragmentUrlId]){
      console.log("default:"+_this.entrypointFragmentUrlId);
      _this.route(_this.entrypointFragmentUrlId);
    }else{
      console.log('There are not any @PageListener defined as entrypoint');
    }
  };
  `;

  //TODO: how initialize onclick before dom insertion
  var routeFunctionTemplate = `
  _this.route = function (fragmentUrlId) {
    var pageListener = _this.listenersByFragmentUrlId[fragmentUrlId];
    var element = pageListener.render();
    document.getElementById("root").innerHTML = '';
    document.getElementById("root").appendChild(element);
    // page.initializeActionListeners();
    pageListener.applyBindings();
  };
  `;

  var locationHashChangedFunctionTemplate = `
  function locationHashChanged() {
    console.log(location.hash);
    var fragment = location.hash.replace("#","");
    if(!_this.listenersByFragmentUrlId[fragment]){
      console.log("There are not any page with name: "+fragment);
      return;
    }
    _this.route(fragment);
  }
  window.onhashchange = locationHashChanged;
  `;

  var globalAttributesTemplate = `
  _this.entrypointFragmentUrlId = "@fragmentUrlId";
  `;

  var instantiateVariableTemplate = `
  _this.context["@dependencyName"] = {
    getActionableElements : function() {
      var actionableElements = [];
      @actionableElementEntries
      return actionableElements;
    },
    getHtml : function() {
      return "@templateRawValue";
    }
  };
  `;

  var actionableElementEntryTemplate = `
  actionableElements.push("@htmlObjectId");
  `;

  _this.createModule = function(options, content) {

    LassieLoaderCommon.logDebug("autoConfigurationLocation:" + options.autoConfigurationLocation);
    LassieLoaderCommon.logDebug("srcLocation:" + options.srcLocation);
    var dependencies = DependencyInjection.getDependecies(options.srcLocation, [".js", ".html"]);

    LassieLoaderCommon.logDebug("dependencies");
    LassieLoaderCommon.logDebug(dependencies);

    LassieLoaderCommon.logDebug("\nPerform instantation...");
    var requires = "";
    var instantiates = "";
    var fragmentListeners = "";
    var entrypointFragmentUrlId;
    for (dependency of dependencies) {
      var dependencyClassName = LassieLoaderCommon.capitalize(dependency.arguments.name);

      if (dependency.type == "Template") {
        var rawStringTemplate = LassieLoaderCommon.getHtmlTemplateAsString(dependency.location);
        var fixedHtmlTemplate = LassieLoaderCommon.fixString(rawStringTemplate);

        var actionableElementEntries = "";

        const $=cheerio.load(rawStringTemplate);
        $('button, select').each(function (index, element) {
          if($(element)){
            if($(element).attr('ls-actionable')==="true"){
              var htmlObjectId = $(element).attr('id');
              if(htmlObjectId){
                var entry = actionableElementEntryTemplate.replace("@htmlObjectId",htmlObjectId);
                actionableElementEntries = actionableElementEntries.concat("\n").concat(entry);
              }
            }
          }
        });

        //instantiate
        var instantiateSentence = instantiateVariableTemplate
          .replace("@dependencyName", dependency.arguments.name)
          .replace("@templateRawValue", fixedHtmlTemplate)
          .replace("@actionableElementEntries", actionableElementEntries);

        instantiates = instantiates.concat("\n").concat(instantiateSentence);
      } else {
        //get require
        var requireSentence = requireTemplate
          .replace("@dependencyClassName", dependencyClassName)
          .replace("@dependencyLocation", dependency.location);
        requires = requires.concat("\n").concat(requireSentence);
        //instantiate
        var instantiateSentence = instantiateModuleTemplate
          .replace("@dependencyClassName", dependencyClassName)
          .replace("@dependencyName", dependency.arguments.name);
        instantiates = instantiates.concat("\n").concat(instantiateSentence);

        if (dependency.arguments.fragmentUrlId) {
          var fragmentMappingSentence = fragmentMappingTemplate
            .replace("@fragmentUrlId", dependency.arguments.fragmentUrlId)
            .replace("@dependencyName", dependency.arguments.name);
          fragmentListeners = fragmentListeners.concat("\n").concat(fragmentMappingSentence);
        }
      }

      //custom configurations

      //lookup default entry point
      if (dependency.arguments.entrypoint == "true") {
        if (dependency.arguments.fragmentUrlId) {
          entrypointFragmentUrlId = dependency.arguments.fragmentUrlId;
        }
      }
    }

    LassieLoaderCommon.logDebug("\nPerform injection...");
    var injections = "";
    for (dependency of dependencies) {

      var variablesToInject = dependency.variablesToInject;

      for (variableToInject of variablesToInject) {
        var injectionSentence = injectionTemplate
          .replace(new RegExp("@dependencyName", 'g'), dependency.arguments.name)
          .replace(new RegExp("@autowireName", 'g'), variableToInject);
        injections = injections.concat("\n").concat(injectionSentence);
      }

    }

    var stringStartFunction = startFunctionTemplate
      .replace("@require", requires)
      .replace("@instantiate", instantiates)
      .replace("@injection", injections)
      .replace("@fragmentListeners", (fragmentListeners.length > 0 ? fragmentListeners : ""));

    var mainPageAttribute;
    if (entrypointFragmentUrlId) {
      mainPageAttribute = globalAttributesTemplate
        .replace("@fragmentUrlId", entrypointFragmentUrlId);
    } else {
      mainPageAttribute =  "console.log('There are not any @PageListener defined as entrypoint')";
    }


    //create start function
    var readyModule = LassieLoaderCommon.addNotParametrizableTemplateFunction(flashBootApplicationTemplate, stringStartFunction);
    readyModule = LassieLoaderCommon.addNotParametrizableTemplateFunction(readyModule, routeFunctionTemplate);
    readyModule = LassieLoaderCommon.addNotParametrizableTemplateFunction(readyModule, locationHashChangedFunctionTemplate);
    readyModule = LassieLoaderCommon.addNotParametrizableTemplateFunction(readyModule, mainPageAttribute);

    readyModule = readyModule.concat("\n").concat(linkStartFunctionTemplate);
    content = readyModule.concat("\n").concat(content);

    LassieLoaderCommon.logDebug(content);

    return content;

  }
}


module.exports = AutoConfigurationModuleCompletion;