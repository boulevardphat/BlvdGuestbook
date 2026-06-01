export function formatName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatClass(className: string): string {
  if (!className) return '';
  // Remove multiple spaces
  let s = className.trim().replace(/\s+/g, ' ');
  
  // Extract grade (10, 11, 12)
  const gradeMatch = s.match(/^(10|11|12|9)/);
  if (!gradeMatch) return className.toUpperCase(); // fallback
  const grade = gradeMatch[1];
  
  // Remove grade from string to process the rest
  s = s.substring(grade.length).trim();
  
  if (!s) return grade;
  
  // Try to find numbers at the end
  const numMatch = s.match(/(\d+)$/);
  const classNum = numMatch ? numMatch[1] : '';
  
  // Remove the number from the string
  if (classNum) {
    s = s.substring(0, s.length - classNum.length).trim();
  }
  
  // Now we have the "subject" or "letters" part, e.g., "Anh", "Địa", "văn sử địa", "c", "C"
  let classLetters = '';
  if (s) {
    // If it's a single word or multiple words
    const words = s.split(' ');
    if (words.length === 1 && words[0].length <= 2) {
      // e.g., "c", "a", "A", "-A" -> just uppercase them
      classLetters = words[0].toUpperCase().replace(/[^A-ZĐ]/g, '');
    } else {
      // e.g., "Anh", "Địa", "văn sử địa"
      // Take the first letter of each word
      classLetters = words.map(w => w.charAt(0).toUpperCase()).join('');
    }
  }
  
  return `${grade}${classLetters}${classNum}`;
}

export function formatSchool(schoolName: string): string {
  if (!schoolName) return '';
  
  const normalized = schoolName.toLowerCase().replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
  
  if (['hv', 'chv', 'chuyenhungvuong', 'hungvuong'].includes(normalized)) {
    return 'Trường THPT Chuyên Hùng Vương';
  }
  if (['ba', 'binhan'].includes(normalized)) {
    return 'Trường THPT Bình An';
  }
  if (['da', 'dian'].includes(normalized)) {
    return 'Trường THPT Dĩ An';
  }
  if (['nk', 'nguyenkhuyen'].includes(normalized)) {
    return 'Trường THPT Nguyễn Khuyến';
  }
  if (['ptnk', 'phothongnangkhieu', 'nangkhieu'].includes(normalized)) {
    return 'Phổ thông năng khiếu';
  }
  
  // Default parsing
  let formatted = formatName(schoolName);
  
  // If user already wrote output format, don't duplicate
  if (!formatted.toLowerCase().startsWith('trường')) {
    formatted = `Trường ${formatted}`;
  }
  if (!formatted.toLowerCase().includes('thpt') && !formatted.toLowerCase().includes('phổ thông')) {
    formatted = formatted.replace('Trường ', 'Trường THPT ');
  }
  
  return formatted;
}
