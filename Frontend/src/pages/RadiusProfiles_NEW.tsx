import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tantml:function_calls>
<invoke name="file_search">
<parameter name="query">**/*.tsx