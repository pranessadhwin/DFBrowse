# Contributing to DFBrowse

Thanks for taking the time to contribute! 🎉

This guide covers how to set up the project, report issues, and submit changes.
Please also read the project [README](README.md).

## Getting Started

```bash
# 1. Fork the repository and clone your fork
git clone https://github.com/<your-username>/DFBrowse.git
cd DFBrowse

# 2. Install dependencies
npm install

# 3. Run DFBrowse from source
npm start
```

## Development Commands

| Command              | Description                            |
| -------------------- | -------------------------------------- |
| `npm start`          | Run DFBrowse from source               |
| `npm run test:policy`| Run the policy-engine unit tests       |
| `npm run build`      | Build the Windows installer (NSIS)     |

## Reporting Issues

Before opening an issue, please:

1. Search [existing issues](../../issues) to see if it has already been
   reported.
2. Use a clear, descriptive title.
3. Include steps to reproduce, expected behaviour, actual behaviour, and your
   environment (OS version, DFBrowse version).

## Submitting Changes

1. Create a branch off `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes and keep them focused on a single concern.
3. Ensure the policy tests still pass:
   ```bash
   npm run test:policy
   ```
4. Commit with a clear, conventional message:
   ```text
   feat: add keyboard shortcut for quick allowlist toggle
   fix: resolve allowlist persistence after restart
   ```
5. Push your branch and open a pull request against `main`.

### Pull Request Checklist

- [ ] Title describes the change clearly.
- [ ] Code follows the existing style of the project.
- [ ] Tests pass (`npm run test:policy`).
- [ ] Relevant docs updated (e.g. README) if behaviour changed.

## Code of Conduct

Be respectful and constructive. This project is maintained by volunteers and
contributors come from all backgrounds.
