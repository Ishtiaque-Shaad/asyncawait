﻿import references = require('references');
import assert = require('assert');
import pipeline = require('./pipeline');
import _ = require('./util');
import extensibility = require('./extensibility');
import Builder = AsyncAwait.Await.Builder;
import Mod = AsyncAwait.Await.Mod;
import Handlers = AsyncAwait.Await.Handlers;
import HandlerOverrides = AsyncAwait.Await.HandlerOverrides;
export = awaitBuilder;


// Bootstrap a basic await builder using a no-op handler.
//TODO: need to work out appropriate 'base' functioanlity/behaviour here...
var awaitBuilder = createAwaitBuilder<Builder>(_.empty, {}, {
    singular: (co, arg) => co.enter(null, arg),
    variadic: (co, args) => co.enter(null, args[0])
});


/** Creates a new await builder function using the specified handler settings. */
function createAwaitBuilder<TBuilder extends Builder>(handlersFactory: (baseHandlers: Handlers, options: {}) => HandlerOverrides, options: {}, baseHandlers: Handlers) {

    // Instantiate the handlers by calling the provided factory function.
    var handlers: Handlers = <any> _.mergeProps({}, baseHandlers, handlersFactory(baseHandlers, options));

    // Create the builder function.
    var builder: TBuilder = <any> function await(arg) {

        //TODO: can this be optimised more, eg like async builder's eval?

        // Ensure this function is executing inside a coroutine.
        var co = pipeline.currentCoro();
        assert(co, 'await: may only be called inside a suspendable function');

        // TODO: temp testing... fast/slow paths
        if (arguments.length === 1) {
            var handlerResult = handlers.singular(co, arg);    
        }
        else {

            // Create a new array to hold the passed-in arguments.
            var len = arguments.length, allArgs = new Array(len);
            for (var i = 0; i < len; ++i) allArgs[i] = arguments[i];

            // Delegate to the specified handler to appropriately await the pass-in value(s).
            var handlerResult = handlers.variadic(co, allArgs);
        }

        // Ensure the passed-in value(s) were handled.
        assert(handlerResult !== pipeline.notHandled, 'await: the passed-in value(s) are not recognised as being awaitable.');

        // Suspend the coroutine until the await handler causes it to be resumed.
        return pipeline.suspendCoro();
    }

    // Tack on the handlers and options properties, and the mod() method.
    builder.handlers = handlers;
    builder.options = options;
    builder.mod = createModMethod(handlers, handlersFactory, options, baseHandlers);

    // Return the await builder function.
    return builder;
}


//TODO: review this method! use name? use type? clarity how overrides/defaults are used, no more 'factory'
/** Creates a mod() method appropriate to the given handler settings. */
function createModMethod(handlers, handlersFactory, options, baseHandlers) {
    return function mod(mod: Mod<Builder>) {

        // Validate the argument.
        assert(arguments.length === 1, 'mod: expected one argument');
        var hasHandlersFactory = !!mod.overrideHandlers;

        // Determine the appropriate options to pass to createAwaitBuilder.
        var opts = _.branch(extensibility.config());
        _.mergeProps(opts, options, mod.defaultOptions);

        // Determine the appropriate handlersFactory and baseHandlers to pass to createAwaitBuilder.
        var newHandlersFactory = hasHandlersFactory ? mod.overrideHandlers : handlersFactory;
        var newBaseHandlers = hasHandlersFactory ? handlers : baseHandlers;

        // Delegate to createAwaitBuilder to return a new async builder function.
        return createAwaitBuilder(newHandlersFactory, opts, newBaseHandlers);
    }
}
