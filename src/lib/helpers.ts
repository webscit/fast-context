import {ContextConsumer} from './controllers/context-consumer.js';
import {ContextProvider} from './controllers/context-provider.js';
import {Context} from './create-context.js';
import {Observable, type FASTElement} from '@microsoft/fast-element';

/**
 * Add a context consumer to a FASTElement attribute
 *
 * ### Note
 * It must be called in the constructor after `super()`.
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
 * Wrap a HMTLElement attribute as context provider
 *
 * ### Note
 * If used for a FASTElement, it must be called in the constructor after `super()`.
 *
 * If it is not a FASTElement, you must set up a {@link ContextRoot} element in
 * your application as the provider notification will happen after the cusomers
 * request their context.
 *
 * @param element Element providing the context
 * @param name Element attribute defining the provider
 * @param options Context provider options
 */
export function defineProvider<E extends HTMLElement, ValueType>(
  element: E,
  name: PropertyKey,
  {
    context,
  }: {
    context: Context<unknown, ValueType>;
  }
): void {
  // Map of instances to controllers
  const controllerMap = new WeakMap<
    E,
    ContextProvider<Context<unknown, ValueType>>
  >();
  // @ts-expect-error Element has no string index
  const initialValue = element[name];

  controllerMap.set(
    element,
    new ContextProvider(element, {context, initialValue})
  );

  // proxy any existing setter for this property and use it to
  // notify the controller of an updated value
  const descriptor = Reflect.getOwnPropertyDescriptor(element, name);
  let newDescriptor: PropertyDescriptor;
  if (descriptor === undefined) {
    const valueMap = new WeakMap<E, ValueType>();
    if (initialValue) {
      valueMap.set(element, initialValue);
    }
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
        // @ts-expect-error ignore typing issue
        oldSetter?.call(this, value);
      },
    };
  }
  Reflect.defineProperty(element, name, newDescriptor);

  // Listen to FAST observable logic as it bypasses the setter
  // overridden here
  // For example attribute reflection will update the provider
  // value.
  const notifier = Observable.getNotifier(element);
  const handler = {
    handleChange(source: HTMLElement, propertyName: string) {
      const accessor = Observable.getAccessors(element).find(
        (accessor) => accessor.name === propertyName
      );
      if (accessor) {
        // @ts-expect-error Element has no string index
        source[propertyName] = accessor.getValue(source);
      }
    },
  };
  notifier.subscribe(handler, name);

  return;
}
