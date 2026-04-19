export function getSeedData() {
  const notebooks = [
    {
      id: 'nb1', name: 'Notes', color: '#5167F4', paper: 'plain',
      pages: [
        {
          id: 'p1', title: 'Welcome',
          updated: Date.now(),
          created: Date.now(),
          body: `# Welcome to NoteMD

Your notes, on your machine. Write in markdown.

- Switch to **Edit** to start writing
- Right-click notebooks to rename or change color`
        },
      ],
    },
  ];

  const tasksByDate = {};

  return { notebooks, tasksByDate };
}
