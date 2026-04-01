"use client";

import React, { useCallback, useRef, useState } from "react";
import { showError, showSuccess } from "../notifications/toast-system";

// Optimistic Update Hook
interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error, originalData: T) => void;
  rollbackDelay?: number;
  successMessage?: string;
  errorMessage?: string;
}

export function useOptimisticUpdate<T>(
  updateFunction: (data: T) => Promise<T>,
  options: OptimisticUpdateOptions<T> = {}
) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const originalDataRef = useRef<T | null>(null);

  const executeUpdate = useCallback(async (data: T): Promise<T | null> => {
    setIsUpdating(true);
    setError(null);
    
    // Store original data for rollback
    originalDataRef.current = data;
    
    try {
      const result = await updateFunction(data);
      
      // Success
      if (options.successMessage) {
        showSuccess(options.successMessage);
      }
      options.onSuccess?.(result);
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Update failed');
      setError(error);
      
      // Show error message
      if (options.errorMessage) {
        showError(options.errorMessage, error.message);
      }
      
      // Rollback after delay
      if (options.rollbackDelay && options.rollbackDelay > 0) {
        setTimeout(() => {
          options.onError?.(error, originalDataRef.current as T);
        }, options.rollbackDelay);
      } else {
        options.onError?.(error, originalDataRef.current as T);
      }
      
      return null;
    } finally {
      setIsUpdating(false);
    }
  }, [updateFunction, options]);

  const reset = useCallback(() => {
    setError(null);
    setIsUpdating(false);
  }, []);

  return {
    executeUpdate,
    isUpdating,
    error,
    reset,
  };
}

// Optimistic List Update Hook
interface OptimisticListOptions<T> {
  onSuccess?: (items: T[]) => void;
  onError?: (error: Error, originalItems: T[]) => void;
  successMessage?: string;
  errorMessage?: string;
}

export function useOptimisticList<T>(
  initialItems: T[],
  options: OptimisticListOptions<T> = {}
) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const originalItemsRef = useRef<T[]>(initialItems);

  const addItem = useCallback(async (item: T, addFunction?: (item: T) => Promise<T>) => {
    setIsUpdating(true);
    setError(null);
    
    // Optimistically add item
    const newItems = [...items, item];
    setItems(newItems);
    originalItemsRef.current = items;
    
    try {
      if (addFunction) {
        const result = await addFunction(item);
        // Replace optimistic item with server result
        setItems(prev => prev.map(prevItem => 
          prevItem === item ? result : prevItem
        ));
      }
      
      if (options.successMessage) {
        showSuccess(options.successMessage);
      }
      options.onSuccess?.(newItems);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add item');
      setError(error);
      
      // Rollback
      setItems(originalItemsRef.current);
      
      if (options.errorMessage) {
        showError(options.errorMessage, error.message);
      }
      options.onError?.(error, originalItemsRef.current);
    } finally {
      setIsUpdating(false);
    }
  }, [items, options]);

  const updateItem = useCallback(async (
    itemId: string | number,
    updates: Partial<T>,
    updateFunction?: (id: string | number, updates: Partial<T>) => Promise<T>
  ) => {
    setIsUpdating(true);
    setError(null);
    
    // Optimistically update item
    const updatedItems = items.map(item => 
      (item as any).id === itemId ? { ...item, ...updates } : item
    );
    setItems(updatedItems);
    originalItemsRef.current = items;
    
    try {
      if (updateFunction) {
        await updateFunction(itemId, updates);
      }
      
      if (options.successMessage) {
        showSuccess(options.successMessage);
      }
      options.onSuccess?.(updatedItems);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update item');
      setError(error);
      
      // Rollback
      setItems(originalItemsRef.current);
      
      if (options.errorMessage) {
        showError(options.errorMessage, error.message);
      }
      options.onError?.(error, originalItemsRef.current);
    } finally {
      setIsUpdating(false);
    }
  }, [items, options]);

  const removeItem = useCallback(async (
    itemId: string | number,
    removeFunction?: (id: string | number) => Promise<void>
  ) => {
    setIsUpdating(true);
    setError(null);
    
    // Optimistically remove item
    const filteredItems = items.filter(item => (item as any).id !== itemId);
    setItems(filteredItems);
    originalItemsRef.current = items;
    
    try {
      if (removeFunction) {
        await removeFunction(itemId);
      }
      
      if (options.successMessage) {
        showSuccess(options.successMessage);
      }
      options.onSuccess?.(filteredItems);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to remove item');
      setError(error);
      
      // Rollback
      setItems(originalItemsRef.current);
      
      if (options.errorMessage) {
        showError(options.errorMessage, error.message);
      }
      options.onError?.(error, originalItemsRef.current);
    } finally {
      setIsUpdating(false);
    }
  }, [items, options]);

  const reset = useCallback(() => {
    setItems(initialItems);
    setError(null);
    setIsUpdating(false);
  }, [initialItems]);

  return {
    items,
    addItem,
    updateItem,
    removeItem,
    isUpdating,
    error,
    reset,
  };
}

// Undo Functionality Hook
interface UndoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndo<T>(initialPresent: T) {
  const [state, setState] = useState<UndoState<T>>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const undo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      
      if (past.length === 0) return currentState;
      
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      
      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState(currentState => {
      const { past, present, future } = currentState;
      
      if (future.length === 0) return currentState;
      
      const next = future[0];
      const newFuture = future.slice(1);
      
      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const set = useCallback((newPresent: T) => {
    setState(currentState => ({
      past: [...currentState.past, currentState.present],
      present: newPresent,
      future: [],
    }));
  }, []);

  const reset = useCallback((newPresent: T) => {
    setState({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return {
    state: state.present,
    set,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    reset,
  };
}

// Optimistic Form Hook
export function useOptimisticForm<T extends Record<string, any>>(
  initialData: T,
  submitFunction: (data: T) => Promise<T>,
  options: OptimisticUpdateOptions<T> = {}
) {
  const [formData, setFormData] = useState<T>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const originalDataRef = useRef<T>(initialData);
  
  const { executeUpdate, isUpdating, error } = useOptimisticUpdate(
    submitFunction,
    options
  );

  const updateField = useCallback((field: keyof T, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const updateFields = useCallback((updates: Partial<T>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const newErrors = { ...errors };
    Object.keys(updates).forEach(key => {
      delete newErrors[key];
    });
    setErrors(newErrors);
  }, [errors]);

  const submit = useCallback(async () => {
    setIsSubmitting(true);
    setErrors({});
    
    try {
      const result = await executeUpdate(formData);
      if (result) {
        setFormData(result);
        originalDataRef.current = result;
      }
      return result;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, executeUpdate]);

  const reset = useCallback(() => {
    setFormData(originalDataRef.current);
    setErrors({});
    setIsSubmitting(false);
  }, []);

  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalDataRef.current);

  return {
    formData,
    updateField,
    updateFields,
    submit,
    reset,
    isSubmitting: isSubmitting || isUpdating,
    errors,
    error,
    hasChanges,
  };
}

// Autosave Hook
export function useAutosave<T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  delay: number = 1000
) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const save = useCallback(async (dataToSave: T) => {
    setIsSaving(true);
    setError(null);
    
    try {
      await saveFunction(dataToSave);
      setLastSaved(new Date());
      showSuccess("Changes saved automatically");
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Autosave failed');
      setError(error);
      showError("Failed to save changes", error.message);
    } finally {
      setIsSaving(false);
    }
  }, [saveFunction]);

  // Trigger save when data changes
  React.useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      save(data);
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, save]);

  return {
    isSaving,
    lastSaved,
    error,
    save: () => save(data),
  };
}
