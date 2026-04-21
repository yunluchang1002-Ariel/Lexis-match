# Lexis Match - Synonym 竞技场

一个基于 Google Gemini AI 驱动的互动式英语词汇学习应用，专为雅思 (IELTS)、托福 (TOEFL) 及四六级 (CET) 准备。

## 🌟 核心功能
- **AI 动态生成**：利用 Gemini API 根据不同难度和考试类别实时生成同义词对。
- **PWA 支持**：可安装至手机主屏幕，支持全屏沉浸式体验及离线访问。
- **错题复习系统**：自动识别学生薄弱环节，生成带有 IPA 音标、中文释义和同义词的 PDF/HTML 复习单。
- **本地记录**：自动保存个人最高分纪录。

## 🚀 如何在本地运行

1. **克隆仓库**:
   ```bash
   git clone <你的 GitHub 仓库地址>
   cd lexis-match
   ```

2. **安装依赖**:
   ```bash
   npm install
   ```

3. **配置环境变量**:
   在根目录创建 `.env` 文件，并添加你的 Gemini API Key:
   ```env
   GEMINI_API_KEY=你的_API_KEY
   ```
   *可以在 [Google AI Studio](https://aistudio.google.com/app/apikey) 免费申请。*

4. **启动开发服务器**:
   ```bash
   npm run dev
   ```

5. **构建生产版本**:
   ```bash
   npm run build
   ```

## 🛠 技术栈
- **Frontend**: React (TypeScript)
- **Styling**: Tailwind CSS
- **Animation**: Motion
- **AI**: Google Generative AI (Gemini 2.0 Flash)
- **Icons**: Lucide React
