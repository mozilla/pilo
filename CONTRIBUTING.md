# Contributing to Spark

Thank you for your interest in contributing to Spark! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Before You Start](#before-you-start)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Submitting Your Contribution](#submitting-your-contribution)
- [Review Process](#review-process)
- [Your First Contribution](#your-first-contribution)
- [Code of Conduct](#code-of-conduct)
- [Questions](#questions)

## Before You Start

### Check Existing Issues

Before starting work, please check if there's already an open issue for what you'd like to contribute. If there isn't, consider opening one to discuss your proposed changes with the maintainers.

### Understand the Project

Spark is a browser automation and AI agent framework. Familiarize yourself with the project's goals and architecture before making significant changes.

### Communication

- For bug reports and feature requests, open an issue
- For questions and discussions, use the appropriate communication channels
- For security issues, please follow our security disclosure policy

## Development Setup

<!-- TODO: Add technical setup instructions -->

This section will include:

- Prerequisites and dependencies
- Local development environment setup
- Running the project locally
- Running tests
- Development tools and workflows

## Making Changes

### Branch Naming Conventions

Use descriptive branch names that follow this pattern:

- `feature/short-description` - For new features
- `fix/short-description` - For bug fixes
- `docs/short-description` - For documentation changes
- `refactor/short-description` - For code refactoring
- `test/short-description` - For test additions or improvements

Example: `feature/add-chrome-extension-support`

### Code Style

- Follow the existing code style and conventions in the project
- Write clear, self-documenting code
- Add comments for complex logic
- Keep functions focused and modular
- Prioritize readability over cleverness

### Commit Messages

Write clear, descriptive commit messages:

- Use the imperative mood ("Add feature" not "Added feature")
- Keep the first line under 72 characters
- Add a blank line followed by a detailed description if needed
- Reference issue numbers when applicable (e.g., "Fix #123")

Example:

```
Add support for Chrome extension automation

Implement browser extension detection and interaction capabilities.
This allows agents to interact with Chrome extensions programmatically.

Fixes #123
```

### Testing

- Write tests for new features and bug fixes
- Ensure all existing tests pass before submitting
- Add both unit tests and integration tests where appropriate
- Document any test-specific setup requirements

## Submitting Your Contribution

### Pull Request Process

1. **Fork and Clone**: Fork the repository and clone it locally
2. **Create a Branch**: Create a new branch for your changes
3. **Make Changes**: Implement your changes following the guidelines above
4. **Test**: Ensure all tests pass and add new tests as needed
5. **Commit**: Commit your changes with clear commit messages
6. **Push**: Push your branch to your fork
7. **Open a Pull Request**: Open a PR against the main repository

### Pull Request Description

Your PR description should include:

- **What**: A clear description of what you've changed
- **Why**: The motivation for the change (link to issue if applicable)
- **How**: An overview of your implementation approach
- **Testing**: What testing you've done
- **Screenshots**: If applicable, include before/after screenshots

Example template:

```markdown
## Description

Brief description of the changes

## Motivation

Why is this change necessary? What problem does it solve?

## Implementation

How did you implement the solution?

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Related Issues

Fixes #123
```

## Review Process

### What to Expect

- Maintainers will review your PR and may request changes
- Be responsive to feedback and questions
- Reviews may take time; please be patient
- Your PR may go through multiple rounds of review

### Review Criteria

Reviewers will check for:

- Code quality and adherence to project standards
- Test coverage and quality
- Documentation updates (if applicable)
- Backward compatibility
- Performance implications
- Security considerations

### Making Updates

- Address review feedback by pushing new commits to your branch
- Respond to review comments to clarify your approach
- Mark conversations as resolved once addressed

## Your First Contribution

New to open source? Here are some ways to get started:

### Good First Issues

Look for issues labeled `good first issue` or `beginner-friendly`. These are specifically curated for newcomers.

### Documentation

Documentation improvements are always welcome and a great way to learn the project:

- Fix typos or clarify unclear sections
- Add examples or tutorials
- Improve code comments

### Small Bug Fixes

Start with small, well-defined bug fixes to get familiar with the contribution process.

### Ask for Help

Don't hesitate to ask questions on issues or in discussions. The community is here to help!

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

Key points:

- Be respectful and inclusive
- Welcome diverse perspectives
- Accept constructive criticism gracefully
- Focus on what's best for the community

## Questions

### Where to Ask

- **General Questions**: Open a discussion or issue
- **Bug Reports**: Open an issue with steps to reproduce
- **Feature Requests**: Open an issue describing your idea
- **Security Issues**: Follow the security disclosure policy

### Getting Help

If you're stuck:

1. Check existing documentation and issues
2. Search for similar questions or problems
3. Ask in the appropriate channel with specific details
4. Be patient and respectful when awaiting responses

## License

By contributing to Spark, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Spark! Your efforts help make browser automation and AI agents more accessible and powerful for everyone.
