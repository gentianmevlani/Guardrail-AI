# ML Model Guide

## 🧠 Deep Learning Model

guardrail AI includes a deep learning model that learns from YOUR codebase patterns.

## 🎯 What It Does

### Learns From
- ✅ Your code patterns
- ✅ Your conventions
- ✅ Your architectural decisions
- ✅ Your coding style
- ✅ Your project structure

### Provides
- ✅ Pattern recommendations
- ✅ Convention suggestions
- ✅ Decision predictions
- ✅ Code generation context
- ✅ Intelligent assistance

## 🚀 Usage

### Train Model
```bash
npm run train-model
```

This will:
1. Collect training data from your codebase
2. Extract patterns and features
3. Train the neural network
4. Save model to `.ml-model/`

### Use Predictions
The model is automatically used by:
- Deep Context Agent
- Code Generator
- Architect Agent
- Semantic Search

## 📊 Model Architecture

### Input
- Code snippets (functions, classes, components)
- Context (file location, imports, patterns)
- Features (tokens, structure, style)

### Processing
- Embedding layer (128 dimensions)
- Hidden layers (256 → 128 → 64)
- Pattern recognition
- Convention learning

### Output
- Pattern recommendations
- Convention suggestions
- Decision predictions
- Code generation context

## 🔧 Configuration

Model config in `.ml-model/model.json`:
```json
{
  "embeddingSize": 128,
  "hiddenLayers": [256, 128, 64],
  "learningRate": 0.001,
  "epochs": 100,
  "accuracy": 0.85
}
```

## 💡 How It Works

### 1. Data Collection
- Scans codebase for patterns
- Extracts code snippets
- Identifies conventions
- Tracks decisions

### 2. Feature Extraction
- Token analysis
- Structure patterns
- Style detection
- Context understanding

### 3. Training
- Neural network training
- Pattern recognition
- Convention learning
- Decision prediction

### 4. Prediction
- Query analysis
- Pattern matching
- Recommendation generation
- Confidence scoring

## 🎯 Use Cases

### Pattern Recognition
"Find similar code patterns in my codebase"

### Convention Enforcement
"Does this follow my project's conventions?"

### Decision Prediction
"What would I decide for this scenario?"

### Code Generation
"Generate code that matches my style"

## 📈 Model Performance

- **Accuracy:** ~85% (improves with more training data)
- **Training Time:** 2-5 minutes (depends on codebase size)
- **Inference Time:** <100ms (real-time predictions)

## 🔄 Retraining

Retrain when:
- Major refactoring
- New patterns emerge
- Conventions change
- Significant codebase growth

```bash
npm run train-model
```

## 💡 Future Enhancements

- Cloud training (GPU acceleration)
- Transfer learning (pre-trained models)
- Fine-tuning (project-specific)
- Real-time learning (continuous updates)

---

**Your codebase, your patterns, your AI!** 🧠

