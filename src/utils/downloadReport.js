export const downloadReport = (content) => {
  const timestamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
  const filename = `report-${timestamp}.txt`;

  const blob = new Blob([content], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
