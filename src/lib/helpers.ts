import {ContextConsumer} from './controllers/context-consumer.js';
import {ContextProvider} from './controllers/context-provider.js';
import {Context} from './create-context.js';
import type {FASTElement} from '@microsoft/fast-element';

/**
 * Add a context consumer to a FASTElement attribute
 *
 * @param element Element on which to add a consumer
 * @param name Element attribute to set with the consumer
 * @param options Consumer options
 * @returns The context consumer
 */
export function defineConsumer<E extends HTMLElement & FASTElement, ValueType>(
  element: E,
  name: PropertyKey,
  {
    context,
    subscribe,
  }: {
    context: Context<unknown, ValueType>;
    subscribe?: boolean;
  }
): ContextConsumer<
  {
    __context__: ValueType;
  },
  E
> {
  const consumer = new ContextConsumer(element, {
    context,
    callback: (value: ValueType) => {
      // @ts-expect-error No index signature on E
      element[name] = value;
    },
    subscribe,
  });

  return consumer;
}

/**
 * Wrap a FASTElement attribute as context provider
 *
 * @param element Element providing the context
 * @param name Element attribute defining the provider
 * @param options Context provider options
 */
export function defineProvider<E extends HTMLElement, ValueType>(
  element: E,
  name: PropertyKey,
  {
    context: context,
  }: {
    context: Context<unknown, ValueType>;
  }
): void {
  // Map of instances to controllers
  const controllerMap = new WeakMap<
    E,
    ContextProvider<Context<unknown, ValueType>>
  >();

  controllerMap.set(element, new ContextProvider(element, {context}));

  // proxy any existing setter for this property and use it to
  // notify the controller of an updated value
  const descriptor = Object.getOwnPropertyDescriptor(element, name);
  let newDescriptor: PropertyDescriptor;
  if (descriptor === undefined) {
    const valueMap = new WeakMap<E, ValueType>();
    newDescriptor = {
      get: function (this: E) {
        return valueMap.get(this);
      },
      set: function (this: E, value: ValueType) {
        controllerMap.get(this)!.setValue(value);
        valueMap.set(this, value);
      },
      configurable: true,
      enumerable: true,
    };
  } else {
    const oldSetter = descriptor.set;
    newDescriptor = {
      ...descriptor,
      set: function (this: E, value: ValueType) {
        controllerMap.get(this)!.setValue(value);
        oldSetter?.call(this, value);
      },
    };
  }
  Object.defineProperty(element, name, newDescriptor);
  return;
}
