#!/usr/bin/env bash
# 📊 CompareView - Startup & Testing Script

echo "🚀 CompareView Module - Startup Guide"
echo "========================================"
echo ""

# Check environment
echo "1️⃣  Checking Environment..."
if [ -z "$REACT_APP_ANTHROPIC_KEY" ]; then
  echo "   ⚠️  REACT_APP_ANTHROPIC_KEY not found"
  echo "   📝 Create .env.local with:"
  echo "      REACT_APP_ANTHROPIC_KEY=sk-ant-xxxxx"
else
  echo "   ✅ REACT_APP_ANTHROPIC_KEY found"
fi

echo ""
echo "2️⃣  Check Installation..."
if [ -f "package.json" ]; then
  echo "   ✅ package.json found"
  
  # Check for required packages
  if npm list chart.js react-chartjs-2 &>/dev/null; then
    echo "   ✅ chart.js & react-chartjs-2 installed"
  else
    echo "   ⚠️  Installing chart.js & react-chartjs-2..."
    npm install chart.js react-chartjs-2
  fi
else
  echo "   ❌ package.json not found"
  exit 1
fi

echo ""
echo "3️⃣  TypeScript Check..."
if npx tsc --noEmit &>/dev/null; then
  echo "   ✅ No TypeScript errors"
else
  echo "   ⚠️  TypeScript errors found:"
  npx tsc --noEmit
fi

echo ""
echo "4️⃣  File Verification..."
FILES=(
  "src/pages/Animals/CompareView.tsx"
  "src/pages/Animals/CompareView/ComparisonChart.tsx"
  "src/pages/Animals/CompareView/ComparisonTable.tsx"
  "src/pages/Animals/CompareView/AIAnalysis.tsx"
  "src/pages/Animals/CompareView/AnimalCard.tsx"
  "src/pages/Animals/CompareView/index.ts"
  "src/pages/Animals/Animals.jsx"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   ✅ $file"
  else
    echo "   ❌ $file (MISSING)"
  fi
done

echo ""
echo "5️⃣  Documentation..."
DOCS=(
  "src/pages/Animals/CompareView/README.md"
  "src/pages/Animals/CompareView/USAGE_EXAMPLES.ts"
  "src/pages/Animals/CompareView/IMPLEMENTATION_CHECKLIST.md"
  "src/pages/Animals/CompareView/DEPLOYMENT_GUIDE.md"
  "src/pages/Animals/CompareView/INDEX.md"
)

for doc in "${DOCS[@]}"; do
  if [ -f "$doc" ]; then
    echo "   📖 $(basename $doc)"
  fi
done

echo ""
echo "========================================"
echo "✅ Ready to Start!"
echo ""
echo "📍 Quick Start:"
echo "   1. npm run dev"
echo "   2. Go to http://localhost:5173/animals"
echo "   3. Select 2-4 animals with checkboxes"
echo "   4. Click 'Comparer ↗' button"
echo "   5. Explore /compare page"
echo ""
echo "📚 Documentation:"
echo "   • README.md - Full guide"
echo "   • USAGE_EXAMPLES.ts - Code samples"
echo "   • IMPLEMENTATION_CHECKLIST.md - What was built"
echo "   • DEPLOYMENT_GUIDE.md - How to deploy"
echo ""
echo "🧪 Testing Commands:"
echo "   npm run dev          # Start dev server"
echo "   npx tsc --noEmit     # Check TypeScript"
echo "   npm run build        # Build for production"
echo ""
echo "Happy comparing! 🐑"
